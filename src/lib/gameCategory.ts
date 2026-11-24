import { getCollection } from 'astro:content';
import games from '../data/games.json';
import { latestPostImageMap } from './gameArt';
import { compareGameRecency } from './gameRecency';

export const GAME_PAGE_SIZE = 18;
const sorts = [
  { path: '', label: 'Mới nhất' },
  { path: 'danh-gia', label: 'Đánh giá' },
  { path: 'a-z', label: 'A–Z' },
  { path: 'z-a', label: 'Z–A' },
] as const;

const categories = {
  mobile: {
    title: 'Game Mobile',
    subtitle: 'Android & iOS',
    seoTitle: 'Game Mobile - Tải game Android, iOS mới nhất',
    description: 'Tổng hợp game mobile hay nhất: game VTC, VNGGames, Funtap, Gosu và các bom tấn quốc tế trên Android & iOS.',
    keywords: 'game mobile, game android, game ios, tải game mobile, game hay cho điện thoại',
  },
  pc: {
    title: 'Game PC / Console',
    subtitle: 'Steam, PlayStation, Xbox, Switch',
    seoTitle: 'Game PC / Console - Game Steam, PlayStation, Xbox, Switch',
    description: 'Tổng hợp game PC và console đáng chơi nhất: Steam, PlayStation, Xbox, Nintendo Switch — từ indie tới bom tấn AAA.',
    keywords: 'game pc, game console, game steam, game ps5, game xbox, game switch',
  },
};

type Category = keyof typeof categories;

export function categoryGames(category: Category) {
  return games.filter((game) =>
    category === 'mobile' ? game.category === 'mobile' : ['pc', 'pc-console'].includes(game.category)
  );
}

const mobileOrigins = [
  { codes: ['cn'], path: 'khu-vuc/trung-quoc', label: 'Trung Quốc' },
  { codes: ['h5'], path: 'nen-tang/h5', label: 'H5' },
  { codes: ['vn', 'trong-nuoc'], path: 'khu-vuc/viet-nam', label: 'Việt Nam' },
  { codes: ['kr'], path: 'khu-vuc/han-quoc', label: 'Hàn Quốc' },
  { codes: ['us'], path: 'khu-vuc/my', label: 'Mỹ' },
  { codes: ['jp'], path: 'khu-vuc/nhat-ban', label: 'Nhật Bản' },
  { codes: ['tw'], path: 'khu-vuc/dai-loan', label: 'Đài Loan' },
  { codes: ['hk'], path: 'khu-vuc/hong-kong', label: 'Hồng Kông' },
  { codes: ['sg'], path: 'khu-vuc/singapore', label: 'Singapore' },
  { codes: ['id'], path: 'khu-vuc/indonesia', label: 'Indonesia' },
];

export function mobileLegacyLists() {
  const mobile = categoryGames('mobile');
  return mobileOrigins
    .map(({ codes, path, label }) => ({
      path,
      label,
      games: mobile.filter((game) => codes.includes(game.legacy?.sourcePath?.split('/')[2] ?? '')),
    }))
    .filter((list) => list.games.length > 0);
}

const pagePath = (page: number, variant: string) =>
  [variant, page > 1 ? String(page) : ''].filter(Boolean).join('/');

export function categoryPagePath(category: Category, page: number, variant = '') {
  const path = pagePath(page, variant);
  return path ? `/${category}/${path}/` : `/${category}/`;
}

export async function gameCategoryPaths(category: Category) {
  const allGames = categoryGames(category);
  const entries = await getCollection('posts');
  const postImages = latestPostImageMap(entries.map(({ data }) => ({
    gameSlug: data.game || '',
    image: data.image || '',
    _ts: data.date ? new Date(data.date).getTime() : 0,
  })));

  // The loai rac khong bao gio lam chip loc: chu cai don (du lieu cu bi cat
  // mat khi nhap 21/11) va ten danh muc/nen tang nham thanh the loai.
  const junkGenres = new Set(['game mobile', 'game pc', 'game trình duyệt']);
  const splitGenres = (raw: string) =>
    raw.split(',').map((genre) => genre.trim()).filter(
      (genre) => genre.length > 1 && !junkGenres.has(genre.toLowerCase()),
    );

  const byGenre = new Map<string, typeof allGames>();
  const now = Date.now();
  const latestPostTs = new Map<string, number>();
  for (const { data } of entries) {
    const slug = data.game || '';
    const ts = data.date ? new Date(data.date).getTime() : 0;
    if (slug && ts > 0 && ts <= now && ts > (latestPostTs.get(slug) || 0)) {
      latestPostTs.set(slug, ts);
    }
  }
  for (const game of allGames) {
    for (const genre of splitGenres(game.genre ?? '')) {
      const genreGames = byGenre.get(genre) ?? [];
      genreGames.push(game);
      byGenre.set(genre, genreGames);
    }
  }
  const usedSlugs = new Set<string>();
  const filters = [
    { path: '', label: 'Tất cả', games: allGames },
    ...(category === 'mobile' ? mobileLegacyLists() : []),
    ...[...byGenre].sort((a, b) => b[1].length - a[1].length).slice(0, 12)
      .map(([label, genreGames]) => {
        const base = label.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'the-loai';
        let slug = base;
        for (let suffix = 2; usedSlugs.has(slug); suffix++) slug = `${base}-${suffix}`;
        usedSlugs.add(slug);
        return { path: `the-loai/${slug}`, label, games: genreGames };
      }),
  ];

  const nameOrder = new Intl.Collator('vi', { sensitivity: 'base' });
  const variantPath = (filter: string, sort: string) =>
    [filter, sort && `sap-xep/${sort}`].filter(Boolean).join('/');

  return filters.flatMap((filter) => sorts.map((sort) => {
    const variant = variantPath(filter.path, sort.path);
    const list = [...filter.games].sort((a, b) => {
      if (sort.path === 'a-z') return nameOrder.compare(a.name, b.name);
      if (sort.path === 'z-a') return nameOrder.compare(b.name, a.name);
      if (sort.path === 'danh-gia') return (b.rating ?? b.provisionalRating ?? 0) - (a.rating ?? a.provisionalRating ?? 0);
      return compareGameRecency(a, b, latestPostTs, nameOrder);
    });
    const totalPages = Math.max(1, Math.ceil(list.length / GAME_PAGE_SIZE));

    return Array.from({ length: totalPages }, (_, index) => {
      const currentPage = index + 1;
      const href = (page: number) => categoryPagePath(category, page, variant);
      return {
        params: { page: pagePath(currentPage, variant) || undefined },
        props: {
          ...categories[category],
          games: list.slice(index * GAME_PAGE_SIZE, currentPage * GAME_PAGE_SIZE),
          postImages,
          currentPage,
          totalPages,
          previousHref: currentPage > 1 ? href(currentPage - 1) : undefined,
          nextHref: currentPage < totalPages ? href(currentPage + 1) : undefined,
          activeFilter: filter.path,
          filters: filters.map(({ path, label }) => ({
            path,
            label,
            href: categoryPagePath(category, 1, variantPath(path, sort.path)),
          })),
          activeSort: sort.path,
          sorts: sorts.map(({ path, label }) => ({
            path,
            label,
            href: categoryPagePath(category, 1, variantPath(filter.path, path)),
          })),
        },
      };
    });
  }).flat());
}
