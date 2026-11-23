import hashlib
import io
import json
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image, ImageOps
import os

BUCKET = "9gate-game-media"
PUBLIC = "https://cdn.so1.asia/"
SOURCE_HOST = "img.9gate.net"
MAX_SIZE = 24 * 1024 * 1024
local = threading.local()

def source_url(url):
    p = urlsplit(url)
    return p.scheme in {"http", "https"} and p.hostname == SOURCE_HOST

def http():
    if not hasattr(local, "http"):
        local.http = requests.Session()
        local.http.headers["User-Agent"] = "9Gate media migration/1.0"
    return local.http

def download(url):
    with http().get(url, timeout=(5, 10), stream=True, allow_redirects=False) as r:
        r.raise_for_status()
        if r.status_code != 200:
            raise ValueError("redirect")
        buf = io.BytesIO()
        for chunk in r.iter_content(65536):
            buf.write(chunk)
            if buf.tell() > MAX_SIZE:
                raise ValueError("size limit")
        return buf.getvalue()

def convert(original):
    with Image.open(io.BytesIO(original)) as raw:
        raw.seek(0)
        image = ImageOps.exif_transpose(raw)
        mode = "RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB"
        image = image.convert(mode)
        if image.width > 600:
            image = image.resize((600, max(1, round(image.height * 600 / image.width))), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=70, method=5, exact=False)
        return output.getvalue()

def get_source(url):
    try:
        return download(url)
    except requests.HTTPError as exc:
        path = urlsplit(url).path
        if exc.response.status_code == 404 and path.startswith("/files/"):
            return download(url.replace("/files/", "/thumb_w/600/files/", 1))
        raise

def migrate(client, url):
    failure = "unknown"
    for attempt in range(2):
        try:
            original = get_source(url)
            data = convert(original)
            key = "game/screenshots/" + hashlib.sha256(data).hexdigest() + ".webp"
            try:
                client.put_object(Bucket=BUCKET, Key=key, Body=data, ContentType="image/webp",
                                  CacheControl="public, max-age=31536000, immutable", IfNoneMatch="*")
            except ClientError as exc:
                if exc.response["ResponseMetadata"]["HTTPStatusCode"] != 412:
                    raise
            public = PUBLIC + key
            for pause in (0, 0.2, 0.6):
                time.sleep(pause)
                try:
                    response = http().head(public, timeout=(5, 8))
                    if (response.status_code == 200 and response.headers.get("Content-Type", "").startswith("image/webp")
                            and response.headers.get("Content-Length") == str(len(data))):
                        return url, {"url": public, "bytes": len(data), "source_bytes": len(original)}
                except requests.RequestException:
                    pass
            return url, {"error": "cdn-check"}
        except requests.HTTPError as exc:
            failure = "source-http-" + str(exc.response.status_code)
            if exc.response.status_code in (400, 403, 404, 410):
                break
        except (requests.RequestException, ValueError, OSError, ClientError) as exc:
            failure = type(exc).__name__
        time.sleep(0.35 * (attempt + 1))
    return url, {"error": failure}

def main():
    path = Path("src/data/games.json")
    games = json.loads(path.read_bytes())
    galleries = [game.get("legacy", {}).get("screenshots", []) for game in games]
    urls = sorted({u for gallery in galleries for u in gallery if source_url(u)})
    if not urls:
        raise ValueError("No old screenshot URLs")
    config = Config(signature_version="s3v4", s3={"addressing_style": "path"}, max_pool_connections=24,
                    connect_timeout=5, read_timeout=10, retries={"mode":"standard", "total_max_attempts":4})
    endpoint = os.environ["R2_ENDPOINT"]
    if urlsplit(endpoint).scheme != "https" or not urlsplit(endpoint).hostname.endswith(".r2.cloudflarestorage.com"):
        raise ValueError("Invalid R2 endpoint")
    client = boto3.client("s3", endpoint_url=endpoint, region_name="auto", config=config)
    client.list_objects_v2(Bucket=BUCKET, Prefix="game/screenshots/", MaxKeys=1)
    def work(url):
        return migrate(client, url)
    results = {}
    with ThreadPoolExecutor(max_workers=20) as executor:
        pilot = sorted(set(urls[::max(1, len(urls)//16)]))
        results.update(executor.map(work, pilot))
        passed = sum("url" in item for item in results.values())
        print(f"Pilot: {passed}/{len(pilot)} verified", flush=True)
        if passed < len(pilot)//2:
            print(dict(Counter(item.get("error", "ok") for item in results.values())), flush=True)
            raise SystemExit("Legacy source or CDN unavailable from runner")
        pending = [u for u in urls if u not in results]
        for start in range(0, len(pending), 450):
            results.update(executor.map(work, pending[start:start+450]))
            print(f"Checked {len(results)}/{len(urls)}; confirmed {sum('url' in item for item in results.values())}", flush=True)
    replacements = {old: item["url"] for old, item in results.items() if "url" in item}
    objects = {item["url"]: item["bytes"] for item in results.values() if "url" in item}
    refs = 0
    for gallery in galleries:
        for i, old in enumerate(gallery):
            if old in replacements:
                gallery[i] = replacements[old]
                refs += 1
    path.write_text(json.dumps(games, ensure_ascii=False, indent=2) + "\n")
    failures = {u: item["error"] for u, item in results.items() if "error" in item}
    report = {
        "checked": len(urls), "verified": len(replacements), "objects": len(objects), "replaced_references": refs,
        "total_bytes": sum(objects.values()), "total_source_bytes": sum(item.get("source_bytes", 0) for item in results.values()),
        "failed": failures
    }
    Path("r2-screenshot-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print({k:v for k,v in report.items() if k!="failed"}, flush=True)
    print("Failed:", dict(Counter(failures.values())), flush=True)

if __name__ == "__main__":
    main()
