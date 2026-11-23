import { selectFeatured } from '../lib/featured.js';

const hero = document.querySelector<HTMLElement>('#hero');
if (hero) {
  const candidates = [...hero.querySelectorAll<HTMLAnchorElement>('[data-slide]')].map((slide) => ({
    slug: slide.dataset.slide!,
    postAt: Number(slide.dataset.postAt),
    starts: Number(slide.dataset.starts),
    ends: Number(slide.dataset.ends),
    slide,
  }));
  const dots = new Map([...hero.querySelectorAll<HTMLButtonElement>('[data-dot]')].map((dot) => [dot.dataset.dot!, dot]));
  const playlist = new Map([...hero.querySelectorAll<HTMLButtonElement>('[data-pl]')].map((button) => [button.dataset.pl!, button]));
  let visible = candidates;
  let active = '';
  let rotation: number | undefined;
  let expiration: number | undefined;

  function show(slug: string) {
    active = slug;
    for (const { slug: candidate, slide } of candidates) {
      const on = candidate === slug;
      slide.classList.toggle('opacity-100', on);
      slide.classList.toggle('z-10', on);
      slide.classList.toggle('opacity-0', !on);
      slide.classList.toggle('pointer-events-none', !on);
      slide.setAttribute('aria-hidden', String(!on));
      slide.tabIndex = on ? 0 : -1;

      const dot = dots.get(candidate)!;
      dot.setAttribute('aria-pressed', String(on));
      dot.classList.toggle('w-6', on);
      dot.classList.toggle('w-1.5', !on);
      dot.classList.toggle('bg-tap', on);
      dot.classList.toggle('bg-black/20', !on);
      dot.classList.toggle('dark:bg-white/30', !on);
      const button = playlist.get(candidate)!;
      button.setAttribute('aria-pressed', String(on));
      for (const cls of ['bg-tap/10', 'ring-1', 'ring-inset', 'ring-tap/35']) button.classList.toggle(cls, on);
      for (const cls of ['hover:bg-black/5', 'dark:hover:bg-white/5']) button.classList.toggle(cls, !on);
    }
  }

  function restart() {
    window.clearInterval(rotation);
    if (visible.length < 2 || !hero || hero.matches(':hover')) return;
    rotation = window.setInterval(() => {
      const index = visible.findIndex(({ slug }) => slug === active);
      show(visible[(index + 1) % visible.length].slug);
    }, 10_000);
  }

  function refresh() {
    if (!hero) return;
    const now = Date.now();
    visible = selectFeatured(candidates, now);
    const shown = new Set(visible.map(({ slug }) => slug));
    hero.hidden = !visible.length;
    for (const { slug, slide } of candidates) {
      const hidden = !shown.has(slug);
      slide.hidden = hidden;
      dots.get(slug)!.hidden = hidden;
      playlist.get(slug)!.hidden = hidden;
    }
    for (const { slug } of visible) {
      const dot = dots.get(slug)!;
      const button = playlist.get(slug)!;
      dot.parentElement!.append(dot);
      button.parentElement!.append(button);
    }
    show(shown.has(active) ? active : visible[0]?.slug || '');
    restart();

    window.clearTimeout(expiration);
    const next = Math.min(...candidates.flatMap(({ starts, ends }) => [starts, ends]).filter((time) => time > now));
    if (Number.isFinite(next)) expiration = window.setTimeout(refresh, Math.min(next - now, 2_147_483_647));
  }

  for (const [slug, button] of [...dots, ...playlist]) {
    button.addEventListener('click', () => { show(slug); restart(); });
  }
  hero.addEventListener('mouseenter', () => window.clearInterval(rotation));
  hero.addEventListener('mouseleave', restart);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', refresh);
  refresh();
}

type Pick = {
  slug: string;
  name: string;
  art: string;
  genre: string;
  publisher: string;
  platforms: string[];
  score?: number;
  mobile: boolean;
};

function sample<T>(items: T[], count: number): T[] {
  const pool = [...items];
  for (let index = 0; index < Math.min(count, pool.length); index++) {
    const randomIndex = index + Math.floor(Math.random() * (pool.length - index));
    [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
  }
  return pool.slice(0, count);
}

async function loadTrending(grid: HTMLElement) {
  const response = await fetch('/home-game-picks.json');
  if (!response.ok) return;
  const all: Pick[] = await response.json();
  const pools = {
    games: all,
    mmorpg: all.filter(({ genre }) => /\bMMORPG\b/i.test(genre || '')),
    mobile: all.filter(({ mobile }) => mobile),
  };
  const key = 'home-game-picks-v1';
  type PoolName = keyof typeof pools;
  let previous: Partial<Record<PoolName, string[]>> = {};
  try { previous = JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch {}
  const next: Partial<Record<PoolName, string[]>> = {};
  const pick = (name: PoolName, count: number) => {
    const pool = pools[name];
    const index = new Map(pool.map((game) => [game.slug, game]));
    const saved = previous[name];
    const selected = Array.isArray(saved) && saved.length === count && new Set(saved).size === count && saved.every((slug) => index.has(slug))
      ? saved.map((slug) => index.get(slug)!)
      : sample(pool, count);
    next[name] = selected.map(({ slug }) => slug);
    return selected;
  };

  const cards = [...grid.querySelectorAll<HTMLAnchorElement>('.game-card')];
  pick('games', cards.length).forEach((game, index) => {
    const card = cards[index];
    const image = card.querySelector('img');
    if (!image) return;
    card.href = `/game/${encodeURIComponent(game.slug)}/`;
    card.dataset.name = game.name.toLowerCase();
    card.dataset.genre = game.genre || '';
    card.dataset.rating = game.score?.toString() || '';
    image.src = game.art;
    image.alt = game.name;
    card.querySelector('h3')!.textContent = game.name;
    card.querySelector('[data-card-genre]')!.textContent = game.genre || '';
    const platforms = (game.platforms || []).join(' · ');
    const platformLabel = card.querySelector<HTMLElement>('[data-card-platforms]')!;
    platformLabel.hidden = !platforms;
    platformLabel.textContent = platforms ? `• ${platforms}` : '';
    card.querySelector('[data-card-publisher]')!.textContent = game.publisher || '';
    const score = card.querySelector<HTMLElement>('[data-card-score]')!;
    score.hidden = game.score == null;
    score.textContent = game.score?.toFixed(1) || '';
    if (game.score == null) score.removeAttribute('aria-label');
    else score.setAttribute('aria-label', `Điểm ${game.score.toFixed(1)}`);
  });

  for (const name of ['mmorpg', 'mobile'] as const) {
    const card = grid.querySelector(`[data-collection="${name}"]`)!;
    const images = card.querySelectorAll('img');
    const labels = card.querySelectorAll('[data-pick-name]');
    pick(name, images.length).forEach((game, index) => {
      images[index].src = game.art;
      images[index].alt = game.name;
      labels[index].textContent = game.name;
    });
  }
  try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
}

const trending = document.querySelector<HTMLElement>('#trending-grid');
if (trending) loadTrending(trending).catch(() => {});
