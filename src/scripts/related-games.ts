import { sample } from '../lib/sample';

type Game = {
  slug: string;
  name: string;
  icon: string;
  genre?: string;
  platforms?: string[];
  score?: number;
  mobile: boolean;
};

async function loadRelatedGames(list: HTMLElement) {
  const rows = [...list.querySelectorAll<HTMLAnchorElement>('a')];
  if (!rows.length) return;

  const { relatedGames: slug, gameGenre: genre, gameMobile } = list.dataset;
  const response = await fetch('/home-game-picks.json');
  if (!response.ok) return;
  const games: Game[] = await response.json();
  const sameCategory = games.filter((game) => game.slug !== slug && game.mobile === (gameMobile === 'true'));
  const sameGenre = genre ? sameCategory.filter((game) => game.genre === genre) : [];
  const other = sameGenre.length ? sameCategory.filter((game) => game.genre !== genre) : sameCategory;

  const storageKey = '9gate-related-games-v1';
  let previous: string[] = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved?.slug === slug && Array.isArray(saved.picks)) previous = saved.picks;
  } catch {}

  const primary = sample(sameGenre, rows.length);
  const secondary = sample(other, rows.length - primary.length);
  const picks = [...primary, ...secondary];
  if (picks.length !== rows.length) return;

  if (picks.every((game) => previous.includes(game.slug))) {
    const alternatives = sameGenre.length >= rows.length ? sameGenre : other;
    const [replacement] = sample(alternatives.filter((game) => !previous.includes(game.slug)), 1);
    if (replacement) picks[picks.length - 1] = replacement;
  }

  for (const [index, game] of picks.entries()) {
    const row = rows[index];
    const next = row.cloneNode(true) as HTMLAnchorElement;
    const icon = next.querySelector<HTMLImageElement>('[data-game-icon]')!;
    const score = next.querySelector<HTMLElement>('[data-game-score]')!;
    next.href = `/game/${game.slug}/`;
    next.querySelector('[data-game-name]')!.textContent = game.name;
    next.querySelector('[data-game-meta]')!.textContent = [game.genre, game.platforms?.[0]].filter(Boolean).join(' • ');
    next.querySelector('[data-game-initial]')!.textContent = game.name.charAt(0);
    icon.hidden = !game.icon;
    if (game.icon) icon.src = game.icon;
    else icon.removeAttribute('src');
    score.hidden = typeof game.score !== 'number';
    score.textContent = typeof game.score === 'number' ? game.score.toFixed(1) : '';
    row.replaceWith(next);
  }

  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ slug, picks: picks.map((game) => game.slug) }));
  } catch {}
}

const list = document.querySelector<HTMLElement>('[data-related-games]');
if (list) loadRelatedGames(list).catch(() => {});
