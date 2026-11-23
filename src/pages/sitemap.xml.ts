import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import games from '../data/games.json';
import { categoryPagePath, gameCategoryPaths } from '../lib/gameCategory';
import { gameImage, latestPostImageMap } from '../lib/gameArt';
import { absoluteImage } from '../lib/seo';
import { groupPostsByTag, mapPost, sortPosts, POST_PAGE_SIZE } from '../lib/tags';

export const prerender = true;

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]!);

export const GET: APIRoute = async ({ site, url }) => {
  const base = site ?? url;
  const posts = await getCollection('posts');
  const postView = sortPosts(posts.map(({ id, data }) => mapPost(id, data)));
  const postImages = latestPostImageMap(postView);
  const gameBySlug = new Map(games.map((game) => [game.slug, game]));
  const categories = await Promise.all((['mobile', 'pc'] as const).map(async (category) =>
    (await gameCategoryPaths(category))
      .filter(({ props }) => !props.activeSort && props.games.length > 0)
      .map(({ props }) => categoryPagePath(category, props.currentPage, props.activeFilter)),
  ));

  type Entry = { path: string; image?: string };
  const entries: Entry[] = [
    { path: '/' },
    ...categories.flat().map((path) => ({ path })),
    ...Array.from({ length: Math.max(1, Math.ceil(posts.length / POST_PAGE_SIZE)) }, (_, index) => ({
      path: index === 0 ? '/cap-nhat/' : `/cap-nhat/${index + 1}/`,
    })),
    ...games.map((game) => ({
      path: `/game/${game.slug}/`,
      image: gameImage(game, postImages[game.slug]),
    })),
    ...postView.map((post) => ({
      path: `/p/${post.slug}/`,
      image: post.image || gameImage(gameBySlug.get(post.gameSlug)),
    })),
    ...groupPostsByTag(postView).flatMap((group) =>
      Array.from({ length: Math.ceil(group.posts.length / POST_PAGE_SIZE) }, (_, index) => ({
        path: `/tags/${group.slug}/${index === 0 ? '' : `${index + 1}/`}`,
      })),
    ),
  ];

  const rows = entries.map(({ path, image }) => {
    const location = escapeXml(new URL(path, base).href);
    const imageUrl = absoluteImage(image, base);
    const imageNode = imageUrl ? `<image:image><image:loc>${escapeXml(imageUrl)}</image:loc></image:image>` : '';
    return `  <url><loc>${location}</loc>${imageNode}</url>`;
  });
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
    + rows.join('\n') + '\n</urlset>\n';

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
