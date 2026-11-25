import games from '../data/games.json';
import { seoSummary } from './seo';

type Game = typeof games[number];
const marketNames: Record<string, string> = {
  vn: 'Việt Nam', 'trong-nuoc': 'Việt Nam', cn: 'Trung Quốc', tw: 'Đài Loan',
  jp: 'Nhật Bản', kr: 'Hàn Quốc', us: 'Mỹ', 'nuoc-ngoai': 'Quốc tế', h5: 'H5',
};
const market = (game: Game) => marketNames[game.legacy?.sourcePath?.split('/')[2] ?? ''];
const rawTitle = (game: Game) => (game.seoTitle || game.name).replace(/\s*\|\s*9Gate$/i, '');
const rawDescription = (game: Game) => seoSummary(game.seoDescription?.trim() || game.description?.trim() || '');
const titleGroups = new Map<string, Game[]>();
const descriptionCounts = new Map<string, number>();
for (const game of games) {
  const key = rawTitle(game).normalize().toLowerCase().trim();
  const group = titleGroups.get(key) ?? [];
  group.push(game);
  titleGroups.set(key, group);
  const description = rawDescription(game);
  descriptionCounts.set(description, (descriptionCounts.get(description) ?? 0) + 1);
}

export function gameSearchMetadata(game: Game, category: string) {
  const title = rawTitle(game);
  const peers = titleGroups.get(title.normalize().toLowerCase().trim()) ?? [];
  const summary = rawDescription(game);
  const identity = (entry: Game) => [
    market(entry), entry.publisher && entry.publisher !== 'Nước Ngoài' ? entry.publisher : '',
  ].filter(Boolean).join(' · ');
  let qualifier = '';
  if (peers.length > 1) {
    qualifier = identity(game);
    if (!qualifier || peers.filter((entry) => identity(entry) === qualifier).length > 1) {
      qualifier = [qualifier, `hồ sơ #${game.legacy?.id ?? game.slug}`].filter(Boolean).join(' · ');
    }
  }
  const displayName = qualifier ? `${game.name} (${qualifier})` : game.name;
  const facts = [game.genre && game.genre.length > 1 ? game.genre : '', game.platforms?.join(', ') || category,
    game.publisher && game.publisher !== 'Nước Ngoài' ? game.publisher : ''].filter(Boolean).join(' · ');
  const duplicated = (descriptionCounts.get(summary) ?? 0) > 1;
  return {
    title: qualifier ? `${title} (${qualifier})` : title,
    description: summary.length >= 55 && !duplicated ? summary
      : seoSummary(`${displayName} trên 9Gate. ${facts}.${!duplicated && summary ? ` ${summary}` : ''}`),
  };
}
