import DOMPurify from "dompurify";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import Turndown from "turndown";
import { gfm as turndownGfm } from "turndown-plugin-gfm";

const byId = (id) => document.getElementById(id);
const videoId = /^[a-zA-Z0-9_-]{11}$/;
const videoHosts = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "youtube-nocookie.com", "www.youtube-nocookie.com",
]);

export function safeWebUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text, location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function youtubeId(value) {
  const text = String(value ?? "").trim();
  if (videoId.test(text)) return text;
  try {
    const url = new URL(text);
    if (!videoHosts.has(url.hostname) || !["http:", "https:"].includes(url.protocol)) return "";
    const [route, id] = url.pathname.split("/").slice(1);
    const candidate = url.hostname === "youtu.be" ? route
      : route === "watch" ? url.searchParams.get("v")
      : ["embed", "shorts", "live"].includes(route) ? id : "";
    return videoId.test(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

function videoPlaceholder(id) {
  const link = document.createElement("a");
  link.href = "https://www.youtube.com/watch?v=" + id;
  link.dataset.youtubeId = id;
  link.textContent = "YouTube · " + id;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function embeddedVideo(id) {
  return `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Video YouTube" width="640" height="360" loading="lazy" allowfullscreen></iframe>`;
}

function cleanHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const frame of template.content.querySelectorAll("iframe")) {
    const id = youtubeId(frame.getAttribute("src"));
    if (id) frame.replaceWith(videoPlaceholder(id));
    else frame.remove();
  }

  // Google Docs pastes bold and italic as inline styles; make them semantic before stripping styles.
  for (const span of [...template.content.querySelectorAll("span[style], b[style]")].reverse()) {
    const weight = span.style.fontWeight;
    const bold = weight === "bold" || Number(weight) >= 600;
    const italic = ["italic", "oblique"].includes(span.style.fontStyle);
    if (span.tagName === "B" && weight === "normal") {
      span.replaceWith(...span.childNodes);
      continue;
    }
    if (italic || bold) {
      const element = document.createElement(bold ? "strong" : "em");
      if (bold && italic) element.append(document.createElement("em"));
      (element.firstElementChild ?? element).append(...span.childNodes);
      span.replaceWith(element);
    }
  }

  const fragment = DOMPurify.sanitize(template.innerHTML, {
    ALLOWED_TAGS: [
      "a", "b", "blockquote", "br", "code", "del", "div", "em", "h1", "h2", "h3", "h4",
      "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "s", "span", "strong",
      "table", "tbody", "td", "th", "thead", "tr", "ul",
    ],
    ALLOWED_ATTR: ["alt", "href", "src", "start", "title", "data-youtube-id"],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const image of fragment.querySelectorAll("img")) {
    const source = image.getAttribute("src");
    if (/^(data|blob):/i.test(source ?? "") || !safeWebUrl(source)) image.remove();
  }
  return fragment;
}

const turndown = new Turndown({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
turndown.use(turndownGfm);
turndown.addRule("youtube", {
  filter: (node) => node.nodeName === "A" && videoId.test(node.dataset.youtubeId ?? ""),
  replacement: (_, node) => "\n\n" + embeddedVideo(node.dataset.youtubeId) + "\n\n",
});

// Leave raw tags in the detached template so cleanHtml can convert trusted YouTube embeds.
const editorGfmHtml = gfmHtml();
delete editorGfmHtml.exit.htmlFlowData;
delete editorGfmHtml.exit.htmlTextData;

function markdownHtml(markdown) {
  return micromark(markdown, {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [editorGfmHtml],
  });
}

function markdownFrom(element) {
  return turndown.turndown(element).trim();
}

function htmlText(fragment) {
  const output = document.createElement("div");
  output.append(fragment);
  return output.innerHTML;
}

function askUrl(message, absolute = false) {
  const value = prompt(message)?.trim();
  const url = safeWebUrl(value);
  if (value && (!url || (absolute && !/^https?:\/\//i.test(value)))) {
    throw new Error("Nhập URL bắt đầu bằng http:// hoặc https://.");
  }
  return url;
}

async function webpFile(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Ảnh vượt 20 MB.");
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob?.type === "image/webp"
      ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: blob.type })
      : file;
  } finally {
    bitmap.close();
  }
}

function requireWorker(connection) {
  if (!/^https?:\/\//i.test(connection.w)) {
    throw new Error("Nhập URL Worker trong mục Kết nối.");
  }
  return connection.w;
}

async function workerResponse(response) {
  const result = await response.json().catch(() => null);
  if (!result) throw new Error("Worker không trả JSON. Kiểm tra kết nối và phiên Cloudflare Access.");
  if (!response.ok || !(result.success || result.status_code === 200)) {
    throw new Error(result.error?.message || result.error || `Worker trả lỗi ${response.status}.`);
  }
  return result;
}

async function hostImage(source, connection) {
  const worker = requireWorker(connection);
  const form = new FormData();
  form.set("action", "upload");
  form.set("format", "json");
  form.set("destination", "image-host");
  form.set("provider", connection.provider || "imgbb");
  form.set("source", typeof source === "string" ? source : await webpFile(source));
  const result = await workerResponse(await fetch(worker, {
    method: "POST", credentials: "include", body: form,
  }));
  const output = result.url || result.image?.url || result.image?.display_url
    || result.data?.url || result.data?.display_url;
  if (!/^https?:\/\//i.test(output ?? "") || !safeWebUrl(output)) {
    throw new Error("Worker không trả URL ảnh hợp lệ.");
  }
  return output;
}

function imageMarkup(url) {
  const image = document.createElement("img");
  image.src = url;
  image.alt = "Ảnh minh họa";
  return image;
}

const markdownFormats = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  formatBlock: { h2: "## ", h3: "### ", blockquote: "> " },
  insertUnorderedList: "- ",
  insertOrderedList: "1. ",
};

export function createPostEditor({ onChange, buildMarkdown, getConnection }) {
  const body = byId("body");
  const visual = byId("visual-editor");
  const preview = byId("prev");
  const source = byId("raw-preview");
  const formats = byId("format-tools");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const status = byId("editor-status");
  const aiResult = byId("ai-result");
  let mode = "edit";
  let revision = 0;
  let uploadBusy = false;
  let visualSelection;
  let aiBase = "";

  function report(message) {
    status.textContent = message;
  }

  function refresh() {
    if (mode === "preview") preview.replaceChildren(cleanHtml(markdownHtml(body.value)));
    if (mode === "markdown") source.textContent = buildMarkdown();
  }

  function setMode(next) {
    if (next === "visual" && mode !== "visual") {
      visual.replaceChildren(cleanHtml(markdownHtml(body.value)));
      visualSelection = null;
    }
    mode = next;
    body.hidden = mode !== "edit";
    visual.hidden = mode !== "visual";
    preview.hidden = mode !== "preview";
    source.hidden = mode !== "markdown";
    formats.hidden = !["edit", "visual"].includes(mode);
    formats.querySelector('[data-format="unlink"]').disabled = mode !== "visual";
    modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
    refresh();
  }

  function visualChanged() {
    body.value = markdownFrom(visual);
    onChange();
  }

  function setMarkdown(markdown) {
    body.value = markdown;
    if (mode === "visual") {
      visual.replaceChildren(cleanHtml(markdownHtml(markdown)));
      visualSelection = null;
    }
    onChange();
  }

  function restoreVisualSelection() {
    visual.focus();
    const selection = getSelection();
    const range = visualSelection && visual.contains(visualSelection.commonAncestorContainer)
      ? visualSelection : document.createRange();
    if (range !== visualSelection) {
      range.selectNodeContents(visual);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function insertContent(fragment, text = markdownFrom(htmlText(fragment.cloneNode(true)))) {
    if (mode === "visual") {
      restoreVisualSelection();
      document.execCommand("insertHTML", false, htmlText(fragment));
      visualChanged();
      return;
    }
    if (mode !== "edit") {
      setMode("edit");
      body.setSelectionRange(body.value.length, body.value.length);
    }
    const { selectionStart: start, selectionEnd: end } = body;
    const prefix = start && !body.value.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
    body.setRangeText(prefix + text + "\n\n", start, end, "end");
    body.focus();
    onChange();
  }

  function runFormat(button) {
    const command = button.dataset.format;
    const block = button.dataset.style;
    const url = command === "createLink" ? askUrl("Nhập địa chỉ liên kết", true) : "";
    if (command === "createLink" && !url) return;
    if (mode === "visual") {
      restoreVisualSelection();
      if (url && getSelection().isCollapsed) {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = url;
        insertContent(link);
      } else {
        document.execCommand(command, false, url || block);
        visualChanged();
      }
      return;
    }
    const { selectionStart: start, selectionEnd: end } = body;
    const selection = body.value.slice(start, end);
    const format = markdownFormats[command];
    let text;
    if (url) text = `[${selection || url}](<${url}>)`;
    else if (Array.isArray(format)) text = format[0] + selection + format[1];
    else text = (start && body.value[start - 1] !== "\n" ? "\n" : "") + (format?.[block] ?? format) + selection;
    body.setRangeText(text, start, end, "end");
    body.focus();
    onChange();
  }

  async function uploadImages(images, toCover = false) {
    if (uploadBusy || !images.length) return;
    uploadBusy = true;
    const startedAt = revision;
    let failures = 0;
    let lastError = "";
    const connection = { ...getConnection() };
    try {
      requireWorker(connection);
      const results = document.createDocumentFragment();
      for (const [index, image] of images.entries()) {
        report(`Đang tải ảnh ${index + 1}/${images.length}…`);
        try {
          const url = await hostImage(image, connection);
          if (startedAt !== revision) return;
          if (toCover) {
            const input = byId("pimage");
            input.value = url;
            input.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            const line = document.createElement("p");
            line.append(imageMarkup(url));
            results.append(line);
          }
        } catch (error) {
          failures++;
          lastError = error.message;
        }
        if (startedAt !== revision) return;
      }
      if (results.childNodes.length) insertContent(results);
      report(failures ? `Lỗi ${failures}/${images.length} ảnh. ${lastError}` : "Đã tải ảnh lên.");
    } catch (error) {
      report(error.message);
    } finally {
      uploadBusy = false;
    }
  }

  const clipboardImages = (data) => [...(data?.files ?? [])].filter((file) => file.type.startsWith("image/"));

  function pasteContent(event) {
    const data = event.clipboardData;
    const html = data?.getData("text/html");
    const images = clipboardImages(data);
    if (!html && !images.length) return;
    event.preventDefault();
    if (html) {
      const safe = cleanHtml(html);
      const hasImage = safe.querySelector("img");
      if (safe.childNodes.length) insertContent(safe);
      if (hasImage) return;
    }
    if (images.length) uploadImages(images);
  }

  const selectFiles = (button, input, toCover) => {
    byId(button).onclick = () => byId(input).click();
    byId(input).onchange = (event) => {
      const files = [...event.target.files];
      event.target.value = "";
      uploadImages(files, toCover);
    };
  };

  modeButtons.forEach((button) => { button.onclick = () => setMode(button.dataset.mode); });
  formats.addEventListener("mousedown", (event) => {
    if (mode === "visual" && event.target.closest("button")) event.preventDefault();
  });
  formats.onclick = (event) => {
    const button = event.target.closest("[data-format]");
    if (!button) return;
    try { runFormat(button); } catch (error) { report(error.message); }
  };
  document.addEventListener("selectionchange", () => {
    const selection = getSelection();
    if (mode === "visual" && selection.rangeCount && visual.contains(selection.anchorNode)
        && visual.contains(selection.focusNode)) visualSelection = selection.getRangeAt(0).cloneRange();
  });
  body.addEventListener("input", onChange);
  visual.addEventListener("input", visualChanged);
  body.addEventListener("paste", pasteContent);
  visual.addEventListener("paste", pasteContent);
  for (const target of [body, visual]) {
    target.addEventListener("dragover", (event) => {
      if (event.dataTransfer.types.includes("Files")) event.preventDefault();
    });
    target.addEventListener("drop", (event) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      uploadImages(clipboardImages(event.dataTransfer));
    });
  }
  byId("pimage").addEventListener("paste", (event) => {
    const images = clipboardImages(event.clipboardData);
    if (!images.length) return;
    event.preventDefault();
    uploadImages(images.slice(0, 1), true);
  });

  selectFiles("thumb-upload", "thumb-file", true);
  selectFiles("body-image-upload", "body-image-file", false);
  byId("body-image-url").onclick = () => {
    try {
      const url = askUrl("Nhập URL ảnh", true);
      if (url) insertContent(imageMarkup(url));
    } catch (error) { report(error.message); }
  };
  byId("body-image-rehost").onclick = () => {
    try {
      const url = askUrl("Nhập URL ảnh cần rehost qua Worker", true);
      if (url) uploadImages([url]);
    } catch (error) { report(error.message); }
  };
  byId("insert-youtube").onclick = () => {
    const input = prompt("Dán URL hoặc mã video YouTube");
    if (!input?.trim()) return;
    const id = youtubeId(input);
    if (id) insertContent(videoPlaceholder(id), embeddedVideo(id));
    else report("URL hoặc mã video YouTube không hợp lệ.");
  };

  byId("rewrite-ai").onclick = async () => {
    if (!body.value.trim()) return report("Nhập nội dung trước khi dùng AI.");
    const startedAt = revision;
    const button = byId("rewrite-ai");
    const current = body.value;
    button.disabled = true;
    report("Đang gửi nội dung tới Worker để biên tập…");
    try {
      const url = requireWorker(getConnection()) + "/gemini-rewrite";
      const response = await fetch(url, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: byId("ptitle").value.trim(),
          tags: byId("ptags").value.trim(),
          game: byId("pgame").selectedOptions[0]?.value ? byId("pgame").selectedOptions[0].text : "",
          contentHtml: htmlText(cleanHtml(markdownHtml(current))),
        }),
      });
      const result = await workerResponse(response);
      if (startedAt !== revision) return;
      const suggestion = markdownFrom(htmlText(cleanHtml(String(result.contentHtml ?? ""))));
      if (!suggestion) throw new Error("Worker không trả nội dung mới.");
      aiBase = current;
      byId("ai-text").value = suggestion;
      aiResult.hidden = false;
      report("Đã có đề xuất. Bấm Dùng bản này để áp dụng.");
    } catch (error) {
      if (startedAt === revision) report("Biên tập AI thất bại. " + error.message);
    } finally {
      button.disabled = false;
    }
  };
  byId("apply-ai").onclick = () => {
    const suggestion = byId("ai-text").value.trim();
    if (!suggestion) return;
    if (body.value !== aiBase && !confirm("Bài đã thay đổi trong lúc chờ. Dùng đề xuất thay cho nội dung hiện tại?")) return;
    setMarkdown(suggestion);
    aiResult.hidden = true;
    report("Đã áp dụng đề xuất.");
  };
  byId("dismiss-ai").onclick = () => { aiResult.hidden = true; report(""); };

  return {
    refresh,
    reset() {
      revision++;
      visualSelection = null;
      aiResult.hidden = true;
      report("");
      setMode("edit");
    },
  };
}
