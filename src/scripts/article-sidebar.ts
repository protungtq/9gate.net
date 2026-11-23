type Entry = { t: string; s: string; u: string; i: string };

const sessionKey = '9gate:article-sidebar:v1';
const sidebar = document.querySelector<HTMLElement>('[data-article-sidebar]');
const desktop = window.matchMedia('(min-width: 1024px)');

function select(pool: Entry[], saved: unknown, count: number): Entry[] {
  const remaining = new Map(pool.map((entry) => [entry.u, entry]));
  const selected: Entry[] = [];

  if (Array.isArray(saved)) {
    for (const url of saved) {
      if (selected.length >= count) break;
      const entry = remaining.get(url);
      if (entry) {
        selected.push(entry);
        remaining.delete(url);
      }
    }
  }

  const candidates = Array.from(remaining.values());
  while (selected.length < count && candidates.length) {
    const [entry] = candidates.splice(Math.floor(Math.random() * candidates.length), 1);
    selected.push(entry);
  }
  return selected;
}

async function populate(aside: HTMLElement) {
  const response = await fetch('/search-index.json');
  if (!response.ok) return;
  const index: Entry[] = await response.json();
  let saved: { posts?: unknown; games?: unknown } = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(sessionKey) || '{}') || {};
  } catch {}

  const next = { ...saved };
  for (const type of ['posts', 'games'] as const) {
    const rows = Array.from(aside.querySelectorAll<HTMLAnchorElement>(`[data-picks="${type}"] a`));
    if (!rows.length) continue;
    const prefix = type === 'posts' ? '/p/' : '/game/';
    const current = type === 'posts' ? location.pathname : aside.dataset.currentGame;
    const pool = index.filter((entry) => entry.u.startsWith(prefix) && entry.t);
    const previous = saved[type];
    const previousCount = Array.isArray(previous) ? previous.length : 0;
    const selected = select(pool, previous, Math.max(rows.length + 1, previousCount));
    next[type] = selected.map((entry) => entry.u);

    selected.filter((entry) => entry.u !== current).slice(0, rows.length).forEach((entry, i) => {
      const row = rows[i];
      row.href = entry.u;
      row.querySelector('[data-pick-title]')!.textContent = entry.t;
      row.querySelector('[data-pick-detail]')!.textContent = entry.s;
      row.querySelector('[data-pick-initial]')!.textContent = entry.t.charAt(0);
      const image = row.querySelector('img')!;
      image.hidden = !entry.i;
      if (entry.i) image.src = entry.i;
      else image.removeAttribute('src');
    });
  }

  try {
    sessionStorage.setItem(sessionKey, JSON.stringify(next));
  } catch {}
}

if (sidebar) {
  sidebar.addEventListener('error', (event) => {
    if (event.target instanceof HTMLImageElement) event.target.hidden = true;
  }, true);

  const showPicks = () => {
    if (!sidebar.hasAttribute('data-stack-on-mobile') && !desktop.matches) return;
    desktop.removeEventListener('change', showPicks);
    populate(sidebar).catch(() => {});
  };
  desktop.addEventListener('change', showPicks);
  showPicks();
}
