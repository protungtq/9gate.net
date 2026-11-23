export const DEFAULT_FEATURE_HOURS = 24;
const HOUR_MS = 3_600_000;

export function featureWindow(game) {
  const starts = Date.parse(game.featuredAt || '');
  if (!game.featured || !Number.isFinite(starts)) return { starts: 0, ends: 0 };
  const hours = game.featuredHours;
  return { starts, ends: starts + (Number.isInteger(hours) && hours > 0 && hours <= 8760 ? hours : DEFAULT_FEATURE_HOURS) * HOUR_MS };
}

export function featuredRank({ postAt, starts, ends }, now) {
  const article = postAt > 0 && postAt <= now ? postAt : 0;
  return Math.max(article, starts <= now && now < ends ? starts : 0);
}

export function selectFeatured(candidates, now, limit = 6) {
  return candidates
    .map((item) => ({ item, rank: featuredRank(item, now) }))
    .filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(({ item }) => item);
}
