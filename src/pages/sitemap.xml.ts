import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import games from '../data/games.json';
import { categoryGames, categoryPagePath, GAME_PAGE_SIZE, mobileLegacyLists } from '../lib/gameCategory';
import { groupPostsByTag, mapPost, sortPosts } from '../lib/tags';

export const prerender = true;

export const GET: APIRoute = async ({ site, url }) => {
  const base = new URL('/', site ?? url).href;
  const posts = await getCollection('posts');
  const today = new Date().toISOString().slice(0, 10);

  type U = { loc: string; lastmod: string; changefreq: string; priority: string };
  const urls: U[] = [
    { loc: '', lastmod: today, changefreq: 'daily', priority: '1.0' },
    ...(['mobile', 'pc'] as const).flatMap((category) =>
      Array.from({ length: Math.max(1, Math.ceil(categoryGames(category).length / GAME_PAGE_SIZE)) }, (_, index) => ({
        loc: categoryPagePath(category, index + 1).slice(1),
        lastmod: today,
        changefreq: 'weekly',
        priority: index === 0 ? '0.9' : '0.8',
      }))
    ),
    ...mobileLegacyLists().flatMap(({ path, games }) =>
      Array.from({ length: Math.ceil(games.length / GAME_PAGE_SIZE) }, (_, index) => ({
        loc: categoryPagePath('mobile', index + 1, path).slice(1),
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.8',
      }))
    ),
    { loc: 'cap-nhat/', lastmod: today, changefreq: 'daily', priority: '0.8' },
    ...games.map((g: any) => ({
      loc: `game/${g.slug}/`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.8',
    })),
    ...posts.map((p: any) => ({
      loc: `p/${String(p.id).replace(/\.(md|mdx)$/i, '')}/`,
      lastmod: p.data.date ? new Date(p.data.date).toISOString().slice(0, 10) : today,
      changefreq: 'monthly',
      priority: '0.6',
    })),
    ...groupPostsByTag(sortPosts(posts.map((p: any) => mapPost(String(p.id), p.data)))).flatMap((group) => {
      const totalPages = Math.max(1, Math.ceil(group.posts.length / 12));
      return Array.from({ length: totalPages }, (_, index) => ({
        loc: `tags/${group.slug}/${index === 0 ? '' : `${index + 1}/`}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.6',
      }));
    }),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${base}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
      )
      .join('\n') +
    `\n</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
