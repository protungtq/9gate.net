// "Do moi" cua mot game: bai viet moi nhat ve game, hoac lan gan nhat game
// duoc tick noi bat/hot.
//
// KHONG dung ngay them game vao site (game-added-dates.json): 1.747 game
// nhap hang loat 21/11/2026 chung mot moc them, dung moc do se day game cu
// len dau danh sach. Game khong co bai viet lan khong co tick thi moc = 0
// va xep sau, giam dan theo diem roi theo ten.

export type RecencyGame = {
  slug: string;
  name: string;
  featuredAt?: string;
  hotAt?: string;
  rating?: number;
  provisionalRating?: number;
};

export function gameRecency(
  game: Pick<RecencyGame, 'slug' | 'featuredAt' | 'hotAt'>,
  latestPostTs: Map<string, number>,
): number {
  const postAt = latestPostTs.get(game.slug) || 0;
  const featuredAt = Date.parse(game.featuredAt || '') || 0;
  const hotAt = Date.parse(game.hotAt || '') || 0;
  return Math.max(postAt, featuredAt, hotAt);
}

export function gameScore(game: Pick<RecencyGame, 'rating' | 'provisionalRating'>): number {
  return game.rating ?? game.provisionalRating ?? 0;
}

// Moi nhat truoc; cung moc thi diem cao truoc; cung diem thi ten A-Z.
export function compareGameRecency(
  a: RecencyGame,
  b: RecencyGame,
  latestPostTs: Map<string, number>,
  nameOrder: Intl.Collator,
): number {
  const byRecency = gameRecency(b, latestPostTs) - gameRecency(a, latestPostTs);
  if (byRecency !== 0) return byRecency;
  const byRating = gameScore(b) - gameScore(a);
  if (byRating !== 0) return byRating;
  return nameOrder.compare(a.name, b.name) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
}
