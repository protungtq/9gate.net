import { createPostEditor, safeWebUrl } from "./post-editor.js";
import { parse, stringify } from "yaml";
import { DEFAULT_FEATURE_HOURS, featureWindow } from "../lib/featured.js";

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const slugify=s=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};
function toast(m,t=""){const e=document.createElement("div");e.className="ts "+t;e.textContent=m;$("#toast").append(e);setTimeout(()=>e.remove(),t=="e"?6000:3500)}
/* theme */
const sT=t=>{document.documentElement.dataset.t=t;LS("cms-theme",t)};
sT(LS("cms-theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"));
$("#theme").onclick=()=>sT(document.documentElement.dataset.t=="dark"?"light":"dark");
/* config */
const cfg = {
  w: "https://9gate.net/tools/cms/api",
  r: "protungtq/9gate.net",
  b: "main",
  j: "/tools/games-data.json",
  provider: "imgbb",
};

try {
  const saved = JSON.parse(LS("9gate-cms-cfg") || "{}");
  if (saved?.provider === "freeimage") cfg.provider = saved.provider;
} catch {}

const connectionButton = $("#cok");
connectionButton.textContent = "Kiểm tra kết nối";
connectionButton.onclick = async () => {
  const status = $("#connection-status");
  const report = (message, error = false) => {
    if (status) status.textContent = message;
    else if (message !== "Đang kiểm tra kết nối…") toast(message, error ? "e" : "o");
  };

  connectionButton.disabled = true;
  report("Đang kiểm tra kết nối…");
  try {
    const file = "khan-mobi-game-mmo-boi-canh-de-che-mong-co-1464.md";
    const result = await api("/github-get?file=" + encodeURIComponent(file));
    if (typeof result.markdown !== "string") throw new Error("Worker không trả về nội dung bài.");
    report("Kết nối thành công. Worker đã đọc được bài từ GitHub.");
  } catch (error) {
    report("Lỗi kết nối: " + error.message, true);
  } finally {
    connectionButton.disabled = false;
  }
};
async function api(path, body) {
  const url = new URL(cfg.w + path);
  if (!body) {
    url.searchParams.set("repo", cfg.r);
    url.searchParams.set("branch", cfg.b);
  }
  const response = await fetch(url, body ? {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo: cfg.r, branch: cfg.b, ...body }),
  } : { credentials: "include" });

  const result = await response.json().catch(() => null);
  if (!result) throw new Error("Worker không trả về JSON. Kiểm tra URL và phiên đăng nhập Cloudflare Access.");
  if (!response.ok || !result.success) throw new Error(result.error || `Worker trả về lỗi ${response.status}.`);
  return result;
}
/* nav */
$$(".nav[data-v]").forEach(b=>b.onclick=()=>{$$(".nav[data-v]").forEach(x=>x.classList.toggle("on",x==b));$$(".v").forEach(v=>v.classList.toggle("on",v.id=="v-"+b.dataset.v));$("#fix").style.display=b.dataset.v=="games"?"flex":"none"});
/* image previews */
document.addEventListener("input",e=>{const id=e.target.dataset?.pv;if(!id)return;const i=$("#"+id),u=safeImageUrl(e.target.value);i.style.display=u?"block":"none";if(u){i.onerror=()=>{i.style.display="none"};i.src=u}else i.removeAttribute("src")});

/* ===== GAMES ===== */
let games=[],base={},fmiss="",editing=null;
const miss={cover:g=>!g.cover,trailer:g=>!g.trailer,rating:g=>g.rating==null&&g.provisionalRating==null};
function gameDataUrls() {
  const raw = cfg.r && `https://raw.githubusercontent.com/${cfg.r}/${cfg.b}/src/data/games.json`;
  return [raw, cfg.j].filter(Boolean);
}
async function loadGames(){let d=null;for(const u of gameDataUrls()){try{const r=await fetch(u);if(r.ok){const data=await r.json();if(Array.isArray(data)){d=data;break}}}catch(e){}}
  if(!Array.isArray(d)){$("#list").innerHTML='<div class="empty">Chưa tải được games.json. Kiểm tra mục Kết nối, hoặc bấm "Nhập games.json" để chọn file từ máy.</div>';return}
  setGames(d)}
function setGames(d,keepBase){games=d;if(!keepBase)base=Object.fromEntries(d.map(g=>[g.slug,JSON.stringify(g)]));renderGames();fillGameSelect()}
function diff(){const cur=Object.fromEntries(games.map(g=>[g.slug,JSON.stringify(g)]));let a=0,c=0,r=0;for(const k in cur){if(!(k in base))a++;else if(base[k]!=cur[k])c++}for(const k in base)if(!(k in cur))r++;return{a,c,r,n:a+c+r}}
function gameIcon(game) {
  const url = safeImageUrl(game.icon);
  const image = url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : "";
  return `<div class="ic" aria-hidden="true"><span>${esc(Array.from(game.name)[0] || "?")}</span>${image}</div>`;
}
$("#list").addEventListener("error", (event) => {
  if (event.target instanceof HTMLImageElement) event.target.remove();
}, true);
function renderGames(){const q=$("#q").value.toLowerCase(),fc=$("#fc").value;$("#nG").textContent=games.length;
  const L=games.filter(g=>(!q||(g.name+" "+(g.publisher||"")).toLowerCase().includes(q))&&(!fc||g.category==fc)&&(!fmiss||miss[fmiss](g)));
  $("#chips").innerHTML=[["","Tất cả",games.length],["cover","Thiếu ảnh bìa",games.filter(miss.cover).length],["trailer","Thiếu trailer",games.filter(miss.trailer).length],["rating","Chưa có điểm",games.filter(miss.rating).length]].map(([k,l,n])=>`<button class="chip ${fmiss==k?"on":""}" data-m="${k}">${l} (${n})</button>`).join("");
  $("#list").innerHTML=L.map(g=>`<div class="gi">${gameIcon(g)}<div class="t"><h3>${esc(g.name)}</h3><p>${esc(g.publisher||"Chưa có nhà phát hành")}</p><p>${esc(g.genre||"")}</p><span class="tg ${g.category=="mobile"?"g":""}">${g.category=="mobile"?"Mobile":"PC / Console"}</span>${featureWindow(g).ends>Date.now()?'<span class="tg g">Nổi bật</span>':""}${g.hot?'<span class="tg g">Hot</span>':""}${miss.cover(g)?'<span class="tg w">Thiếu bìa</span>':""}${miss.trailer(g)?'<span class="tg w">Thiếu trailer</span>':""}</div><div class="rt">${esc(g.rating??(g.provisionalRating!=null?`${g.provisionalRating.toFixed(1)} (tham khảo)`:"–"))}<small>điểm</small></div><div class="ac"><button data-e="${esc(g.slug)}">Sửa</button><button data-x="${esc(g.slug)}" style="color:var(--dn)">Xóa</button></div></div>`).join("")||'<div class="empty">Không có game nào khớp bộ lọc.</div>';
  const d=diff(),f=$("#fix");f.classList.toggle("dirty",d.n>0);$("#fs").textContent=d.n?`Chưa đẩy lên GitHub: ${d.a} thêm, ${d.c} sửa, ${d.r} xóa`:`${games.length} game, đã đồng bộ`}
["q","fc"].forEach(i=>$("#"+i).oninput=renderGames);
$("#chips").onclick=e=>{if(e.target.dataset.m!==undefined){fmiss=e.target.dataset.m;renderGames()}};
$("#list").onclick=e=>{const s=e.target.dataset;if(s.e)openForm(s.e);if(s.x)delGame(s.x)};
const F=["name","slug","publisher","genre","category","platforms","icon","cover","trailer","website","android","ios","description","rating","seoTitle","seoDescription","seoKeywords"];
function openForm(slug){editing=slug||null;const g=games.find(x=>x.slug==slug)||{category:"mobile"};$("#ft").textContent=slug?"Sửa game: "+g.name:"Thêm game mới";
  F.forEach(k=>{$("#"+k).value=k=="platforms"?(g.platforms||[]).join(", "):g[k]??""});$("#slug").disabled=!!slug;$("#hot").checked=!!g.hot;
  const { ends } = featureWindow(g);
  $("#featured").checked = ends > Date.now();
  $("#featured-hours").value = String(g.featuredHours ?? DEFAULT_FEATURE_HOURS);
  $("#featured-hours").disabled = !$("#featured").checked;
  $("#featured-status").textContent = ends > Date.now()
    ? `Hết hạn lúc ${new Date(ends).toLocaleString("vi-VN")}. Bỏ tick rồi tick lại để ghim từ đầu.`
    : "Mặc định 24 giờ kể từ lần lưu ghim.";
  renewFeature = false;
  ["icon","cover"].forEach(k=>$("#"+k).dispatchEvent(new Event("input",{bubbles:true})));$("#gl").style.display="none";$("#gf").style.display="block";scrollTo(0,0)}
let renewFeature = false;
$("#featured").onchange = () => {
  $("#featured-hours").disabled = !$("#featured").checked;
  if ($("#featured").checked) renewFeature = true;
};
const closeForm=()=>{$("#gf").style.display="none";$("#gl").style.display="block"};
$("#add").onclick=()=>openForm();$("#back").onclick=closeForm;
$("#name").oninput=()=>{if(!editing)$("#slug").value=slugify($("#name").value)};
$("#save").onclick=()=>{const v=k=>$("#"+k).value.trim(),name=v("name"),slug=v("slug");
  if(!name||!slug)return toast("Nhập tên game và slug trước khi lưu","e");
  if(!editing&&games.some(g=>g.slug==slug))return toast("Slug này đã có, hãy chọn slug khác","e");
  const rt=v("rating");if(rt!==""&&(+rt<0||+rt>10||isNaN(+rt)))return toast("Điểm đánh giá phải từ 0 đến 10","e");
  const cat=v("category"),pub=v("publisher"),gen=v("genre"),desc=v("description");
  const g={slug,name,publisher:pub,genre:gen,platforms:v("platforms").split(",").map(s=>s.trim()).filter(Boolean),category:cat,icon:v("icon"),cover:v("cover"),trailer:v("trailer"),description:desc,website:v("website")};
  if(!g.platforms.length)g.platforms=[cat=="mobile"?"Mobile":"PC"];
  if(rt!=="")g.rating=+(+rt).toFixed(1);const an=v("android"),io=v("ios");if(an)g.android=an;if(io)g.ios=io;const oldG=games.find(x=>x.slug===slug),todayStr=new Date().toISOString().slice(0,10);if(rt===""&&oldG?.provisionalRating!=null)g.provisionalRating=oldG.provisionalRating;if(oldG?.trailerType&&oldG.trailer===g.trailer)g.trailerType=oldG.trailerType;
  const now = new Date();
  if (!oldG || oldG.addedAt) g.addedAt = oldG?.addedAt || now.toISOString();
  if (oldG?.legacy) g.legacy = oldG.legacy;
  if ($("#featured").checked) {
    const hours = Number(v("featured-hours") || DEFAULT_FEATURE_HOURS);
    if (!Number.isInteger(hours) || hours < 1 || hours > 8760) return toast("Thời hạn nổi bật phải là số giờ nguyên từ 1 đến 8760","e");
    const keepStart = !renewFeature && featureWindow(oldG || {}).ends > now.getTime()
      && hours === (oldG?.featuredHours ?? DEFAULT_FEATURE_HOURS);
    g.featured = true;
    g.featuredAt = keepStart ? oldG.featuredAt : now.toISOString();
    g.featuredHours = hours;
  }
  if($("#hot").checked){g.hot=true;g.hotAt=(oldG&&oldG.hot&&oldG.hotAt)||todayStr}
  g.seoTitle=v("seoTitle")||`${name} - Tải game, cập nhật, review | 9Gate`;g.seoDescription=v("seoDescription")||desc.slice(0,150);g.seoKeywords=v("seoKeywords")||`${name}, tải ${name}, ${pub}, ${gen}`;
  const i=games.findIndex(x=>x.slug==slug);i>=0?games[i]=g:games.push(g);toast(`Đã lưu "${name}". Nhớ đẩy lên GitHub để đăng`,"o");closeForm();renderGames();fillGameSelect()};
function delGame(s){const g=games.find(x=>x.slug==s);if(g&&confirm(`Xóa game "${g.name}" khỏi danh sách?`)){games=games.filter(x=>x.slug!=s);renderGames();fillGameSelect();toast("Đã xóa. Nhớ đẩy lên GitHub để áp dụng")}}
const gjson=()=>JSON.stringify(games,null,2);
$("#exp").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([gjson()],{type:"application/json"}));a.download="games.json";a.click()};
$("#imp").onclick=()=>$("#file").click();
$("#file").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d))throw 0;setGames(d,true);toast(`Đã nhập ${d.length} game`,"o")}catch(x){toast("File không phải games.json hợp lệ","e")}e.target.value=""};
$("#push").onclick=async()=>{const d=diff();if(!d.n&&!confirm("Chưa có thay đổi nào. Vẫn đẩy lên?"))return;if(!confirm(`Đẩy ${games.length} game lên ${cfg.r}?`))return;
  try{await api("/github-push",{title:`Cập nhật games.json (${games.length} game)`,filename:"games.json",path:"src/data/games.json",markdownContent:gjson(),repo:cfg.r});base=Object.fromEntries(games.map(g=>[g.slug,JSON.stringify(g)]));renderGames();toast("Đã đẩy lên GitHub. Trang sẽ tự build lại sau vài phút","o")}catch(e){toast("Đẩy thất bại: "+e.message,"e")}};
addEventListener("beforeunload",e=>{if(diff().n){e.preventDefault();e.returnValue=""}});

/* ===== POSTS ===== */
const P = (id) => $("#" + id);
const draftKey = "9gate-cms-post-draft";
const fields = {
  ptitle: "title",
  pdesc: "description",
  pdate: "date",
  pupd: "updated",
  pimage: "image",
  pauthor: "author",
  pgame: "game",
  ptype: "type",
  psn: "sourceName",
  psu: "sourceUrl",
  ptags: "tags",
};
let original = {};
let slugEdited = false;
let busy = false;

const safeImageUrl = (value) => safeWebUrl(value);

function fillGameSelect(selected = P("pgame").value) {
  const select = P("pgame");
  const match = games.find((game) => game.slug === selected)
    ?? games.find((game) => game.name.toLowerCase() === selected.toLowerCase());
  const slug = match?.slug ?? selected;
  const options = games.slice().sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((game) => new Option(game.name, game.slug));
  if (slug && !match) options.push(new Option(slug, slug));
  select.replaceChildren(new Option("Không gắn game", ""), ...options);
  select.value = slug;
  showGameLink();
}

function showGameLink() {
  const game = games.find((game) => game.slug === P("pgame").value);
  const hint = P("game-link");
  hint.replaceChildren();
  if (!game) return;
  const link = document.createElement("a");
  link.href = "/game/" + encodeURIComponent(game.slug) + "/";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Xem trang " + game.name;
  hint.append(link);
}

const vietNamTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function dateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(text)) {
    return text.length === 10 ? text + "T00:00" : text.slice(0, 16);
  }
  return vietNamTime.format(date).replace(" ", "T");
}

function parsePost(markdown) {
  const text = markdown.replace(/^\uFEFF/, "");
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)([\s\S]*)/m);
  if (!match || match.index !== 0) return { metadata: {}, body: text };
  const metadata = parse(match[1]) ?? {};
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Frontmatter phải là một nhóm trường YAML.");
  }
  return { metadata, body: match[2].replace(/^\r?\n/, "") };
}

function postValues() {
  return Object.fromEntries(
    Object.entries(fields).map(([id, key]) => [key, P(id).value.trim()]),
  );
}

function buildMarkdown() {
  const values = postValues();
  const metadata = { ...original };
  for (const key of ["title", "description", "date", "updated", "image", "author", "game", "type", "source", "tags"]) {
    delete metadata[key];
  }

  const dateValue = (key) => values[key]
    ? values[key] === dateInput(original[key]) ? original[key] : values[key] + ":00+07:00"
    : "";
  const originalTags = Array.isArray(original.tags) ? original.tags : [];
  const tags = values.tags === originalTags.join(", ")
    ? originalTags : values.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const originalSource = typeof original.source === "object" ? original.source : {};
  const source = { ...originalSource };
  delete source.name;
  delete source.url;
  if (values.sourceName) source.name = values.sourceName;
  if (values.sourceUrl) source.url = values.sourceUrl;

  const frontmatter = {
    title: values.title,
    description: values.description,
    date: dateValue("date"),
    ...(values.updated && { updated: dateValue("updated") }),
    image: values.image,
    ...(values.author && { author: values.author }),
    ...(values.game && { game: values.game }),
    type: values.type,
    ...(Object.keys(source).length && { source }),
    ...(tags.length && { tags }),
    ...metadata,
  };
  return `---\n${stringify(frontmatter, { lineWidth: 0 })}---\n\n${P("body").value.trimEnd()}\n`;
}

function fillPost(metadata, body, slug = "") {
  original = metadata;
  const values = {
    ...metadata,
    date: dateInput(metadata.date),
    updated: dateInput(metadata.updated),
    sourceName: metadata.source?.name,
    sourceUrl: metadata.source?.url,
    tags: Array.isArray(metadata.tags) ? metadata.tags.join(", ") : "",
    type: metadata.type || "Cập nhật",
  };
  for (const [id, key] of Object.entries(fields)) {
    if (id !== "pgame") P(id).value = values[key] ?? "";
  }
  if (P("ptype").value !== values.type) {
    P("ptype").add(new Option(values.type, values.type));
    P("ptype").value = values.type;
  }
  fillGameSelect(String(values.game ?? ""));
  P("pslug").value = slug;
  slugEdited = Boolean(slug);
  P("body").value = body;
  P("pimage").dispatchEvent(new Event("input", { bubbles: true }));
  editor.reset();
}

function snapshot() {
  return JSON.stringify({
    markdown: buildMarkdown(),
    slug: P("pslug").value,
    slugEdited,
  });
}

function saveDraft() {
  const draft = snapshot();
  LS(draftKey, draft);
  P("draft-status").textContent = LS(draftKey) === draft
    ? "Đã lưu nháp trên trình duyệt này."
    : "Không lưu được bản nháp. Bạn có thể tải file .md.";
  editor.refresh();
}

function clearDraft() {
  try { localStorage.removeItem(draftKey); } catch {}
  P("draft-status").textContent = "";
}

function canReplaceDraft() {
  return !LS(draftKey) || confirm("Thay bản nháp hiện tại? Bạn có thể tải file .md để giữ một bản.");
}

function newPost() {
  clearDraft();
  fillPost({ date: new Date().toISOString() }, "");
  P("lp").value = "";
}

function readDraft() {
  const saved = LS(draftKey);
  if (!saved) return newPost();
  try {
    const draft = JSON.parse(saved);
    const { metadata, body } = parsePost(draft.markdown);
    fillPost(metadata, body, draft.slug);
    slugEdited = draft.slugEdited;
    P("draft-status").textContent = "Đã khôi phục bản nháp trên trình duyệt này.";
  } catch {
    newPost();
    toast("Không khôi phục được bản nháp cũ.", "e");
  }
}

const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function postSlug(value) {
  const text = value.trim();
  let path = text;
  if (text.includes("/")) {
    try {
      path = decodeURIComponent(new URL(text, location.origin).pathname).replace(/\/+$/, "").split("/").pop();
    } catch {
      return "";
    }
  }
  const slug = path.replace(/\.(?:md|markdown)$/i, "");
  return validSlug.test(slug) ? slug : "";
}

async function runPostAction(action, errorMessage) {
  if (busy) return;
  busy = true;
  const buttons = ["lo", "ld", "ln", "ppush", "import-post"].map(P);
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await action();
  } catch (error) {
    toast(errorMessage + ": " + error.message, "e");
  } finally {
    busy = false;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

P("ptitle").addEventListener("input", () => {
  if (!slugEdited) P("pslug").value = slugify(P("ptitle").value);
});
P("pslug").addEventListener("input", () => { slugEdited = true; });
P("pgame").addEventListener("change", showGameLink);
P("reset-slug").onclick = () => {
  slugEdited = false;
  P("pslug").value = slugify(P("ptitle").value);
  saveDraft();
};
for (const id of [...Object.keys(fields), "pslug"]) {
  P(id).addEventListener("input", saveDraft);
}
P("ln").onclick = () => { if (canReplaceDraft()) newPost(); };
P("import-post").onclick = () => { if (canReplaceDraft()) P("post-file").click(); };
P("post-file").onchange = async () => {
  const file = P("post-file").files[0];
  P("post-file").value = "";
  if (!file) return;
  try {
    const { metadata, body } = parsePost(await file.text());
    fillPost(metadata, body, postSlug(file.name) || slugify(String(metadata.title ?? "")));
    P("lp").value = "";
    saveDraft();
    toast("Đã nhập bản Markdown.", "o");
  } catch (error) {
    toast("Không nhập được Markdown: " + error.message, "e");
  }
};

P("lo").onclick = () => {
  const slug = postSlug(P("lp").value || P("pslug").value);
  if (!slug) return toast("Nhập slug hoặc link bài viết hợp lệ.", "e");
  if (!canReplaceDraft()) return;
  const before = snapshot();
  runPostAction(async () => {
    const result = await api("/github-get?file=" + encodeURIComponent(slug + ".md"));
    if (typeof result.markdown !== "string") throw new Error("Worker không trả về nội dung Markdown.");
    const { metadata, body } = parsePost(result.markdown);
    if (snapshot() !== before && !canReplaceDraft()) return;
    clearDraft();
    fillPost(metadata, body, slug);
    P("lp").value = slug;
    toast("Đã mở bài viết.", "o");
  }, "Không mở được bài");
};

P("ld").onclick = () => {
  const slug = postSlug(P("lp").value || P("pslug").value);
  if (!slug) return toast("Nhập slug hoặc link bài cần xóa.", "e");
  const filename = slug + ".md";
  if (!confirm(`Xóa vĩnh viễn ${filename} trên ${cfg.r} (${cfg.b})?`)) return;
  runPostAction(async () => {
    await api("/github-delete", { filename, path: "src/content/posts/" + filename });
    P("lp").value = "";
    toast("Đã xóa bài viết. Bản nháp trên máy vẫn còn nếu đã lưu.", "o");
  }, "Xóa thất bại");
};

P("ppush").onclick = () => {
  const title = P("ptitle").value.trim();
  const slug = P("pslug").value.trim() || slugify(title);
  if (!title) return toast("Nhập tiêu đề bài viết.", "e");
  if (!validSlug.test(slug)) return toast("Slug chỉ dùng chữ thường, số và dấu gạch ngang.", "e");
  if (!P("pdate").value) return toast("Chọn ngày xuất bản.", "e");
  const filename = slug + ".md";
  if (!confirm(`Đăng hoặc ghi đè ${filename} lên ${cfg.r} (${cfg.b})?`)) return;

  const before = snapshot();
  const markdownContent = buildMarkdown();
  const notifyGoogle = P("pgi").checked;
  runPostAction(async () => {
    await api("/github-push", { title, filename, path: "src/content/posts/" + filename, markdownContent });
    if (snapshot() === before) {
      P("pslug").value = slug;
      slugEdited = true;
      P("lp").value = slug;
      clearDraft();
    }
    toast("Đã đăng bài lên GitHub.", "o");
    if (notifyGoogle) {
      try {
        await api("/google-index", { articleUrl: new URL(`/p/${slug}/`, connectionButton.dataset.siteOrigin || $("#cs")?.value || new URL(cfg.w).origin).href });
        toast("Đã báo Google index.", "o");
      } catch (error) {
        toast("Đã đăng bài, nhưng báo Google lỗi: " + error.message, "e");
      }
    }
  }, "Đăng thất bại");
};

P("pmd").onclick = () => {
  const slug = postSlug(P("pslug").value) || slugify(P("ptitle").value) || "bai-viet";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([buildMarkdown()], { type: "text/markdown;charset=utf-8" }));
  link.download = slug + ".md";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

const editor = createPostEditor({
  onChange: saveDraft,
  buildMarkdown,
  getConnection: () => cfg,
});

readDraft();
loadGames();
