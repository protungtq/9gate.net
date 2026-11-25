export interface SearchEntry {
  t: string;
  s: string;
  i: string;
  u: string;
  k?: string;
}

let indexRequest: Promise<SearchEntry[]> | undefined;
export function loadSearchIndex() {
  indexRequest ??= fetch('/search-index.json').then((response) => {
    if (!response.ok) throw new Error('Không tải được dữ liệu tìm kiếm');
    return response.json() as Promise<SearchEntry[]>;
  }).catch((error) => {
    indexRequest = undefined;
    throw error;
  });
  return indexRequest;
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replaceAll('đ', 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function searchEntries(index: SearchEntry[], query: string) {
  const term = normalize(query);
  if (!term) return [];
  const tokens = term.split(' ');
  return index.map((entry) => {
    const title = normalize(entry.t);
    const context = normalize(`${entry.s} ${entry.k ?? ''}`);
    const score = title === term ? 5 : title.startsWith(term) ? 4 : title.includes(term) ? 3
      : tokens.every((token) => title.includes(token)) ? 2
      : tokens.every((token) => `${title} ${context}`.includes(token)) ? 1 : 0;
    return { entry, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).map(({ entry }) => entry);
}

export function searchResultLink(entry: SearchEntry) {
  const link = document.createElement('a');
  link.href = entry.u;
  link.className = 'flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10';
  if (entry.i) {
    const image = document.createElement('img');
    image.src = entry.i;
    image.alt = '';
    image.loading = 'lazy';
    image.className = 'w-10 h-10 rounded-[22%] object-cover shrink-0';
    link.append(image);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'w-10 h-10 rounded-[22%] bg-tap/15 shrink-0';
    link.append(placeholder);
  }
  const label = document.createElement('span');
  label.className = 'min-w-0';
  const title = document.createElement('span');
  title.className = 'block font-bold text-sm';
  title.textContent = entry.t;
  const subtitle = document.createElement('span');
  subtitle.className = 'block text-xs muted';
  subtitle.textContent = entry.s;
  label.append(title, subtitle);
  link.append(label);
  return link;
}
