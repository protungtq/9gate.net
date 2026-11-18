import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const postDirectory = 'src/content/posts';
const endpoint = 'https://api.imgbb.com/1/upload';
const apiKey = process.env.IMGBB_API_KEY?.trim();
const isLegacyCover = /^\/images\/9gate-news\/[\w-]+\.(webp|jpg|png)$/i;
const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/;
const imageField = /^image:[ \t]*"([^"\r\n]*)"[ \t]*$/m;

if (!apiKey) {
  console.error('Thiếu biến môi trường IMGBB_API_KEY.');
  process.exit(1);
}

function legacyImageUrl(value) {
  if (!value.startsWith('https://')) return false;
  try {
    const url = new URL(value);
    return url.origin === 'https://img.9gate.net' && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function uploadImage(source) {
  const requestUrl = new URL(endpoint);
  requestUrl.searchParams.set('key', apiKey);
  const form = new FormData();
  if (isLegacyCover.test(source)) {
    const part = new Blob([await readFile('public' + source)]);
    form.set('image', part, source.split('/').at(-1));
  } else {
    form.set('image', source);
  }

  const response = await fetch(requestUrl, {
    method: 'POST',
    body: form,
    redirect: 'error',
    signal: AbortSignal.timeout(35000),
  });
  if (!response.ok) throw new Error(`ImgBB trả HTTP ${response.status}.`);
  const result = await response.json();
  const destination = new URL(result.data?.url);
  if (!result.success || destination.origin !== 'https://i.ibb.co' || destination.username || destination.password) {
    throw new Error('ImgBB không trả URL ảnh trực tiếp hợp lệ.');
  }

  const probe = await fetch(destination, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  await probe.body?.cancel();
  if (!probe.ok || !probe.headers.get('content-type')?.startsWith('image/')) {
    throw new Error('URL ảnh mới chưa trả về ảnh hợp lệ.');
  }
  return destination.href;
}

const files = process.argv.slice(2);
const posts = files.length
  ? files
  : (await readdir(postDirectory)).filter(name => name.endsWith('.md')).sort().map(name => join(postDirectory, name));

for (const file of posts) {
  try {
    const contents = await readFile(file, 'utf8');
    const metadata = contents.match(frontmatter)?.[0];
    const source = metadata?.match(imageField)?.[1];
    if (!source || (!isLegacyCover.test(source) && !legacyImageUrl(source))) continue;

    const hosted = await uploadImage(source);
    const updated = metadata.replace(imageField, () => `image: ${JSON.stringify(hosted)}`) + contents.slice(metadata.length);
    const temporary = `${file}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, updated, { flag: 'wx' });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
    console.log(`Đã cập nhật ảnh ${file}`);
  } catch {
    console.error(`Chuyển ảnh thất bại cho ${file}. Ảnh hiện tại vẫn được giữ.`);
    process.exitCode = 1;
  }
}
