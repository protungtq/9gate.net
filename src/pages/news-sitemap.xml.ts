import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { articleDate, articleDateMetadata, isNewsArticle, NEWS_WINDOW_MS } from '../lib/news';

export const prerender = true;

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]!);
}

export const GET: APIRoute = async ({ site, url }) => {
  const now = Date.now();
  const articles = (await getCollection('posts'))
    .flatMap(({ id, data }) => {
      const slug = id.replace(/\.(md|mdx)$/i, '');
      const date = articleDate(data.date)?.getTime();
      const title = data.title?.replace(/\s+/g, ' ').trim();
      if (!title || date === undefined || date > now || date <= now - NEWS_WINDOW_MS ||
          !isNewsArticle(slug, data.type)) return [];
      return [{ slug, date, title, published: articleDateMetadata(data.date)! }];
    })
    .sort((a, b) => b.date - a.date)
    .slice(0, 1000);

  const rows = articles.map(({ slug, title, published }) => {
    const location = escapeXml(new URL(`/p/${slug}/`, site ?? url).href);
    return `  <url><loc>${location}</loc><news:news><news:publication><news:name>9Gate</news:name><news:language>vi</news:language></news:publication><news:publication_date>${published}</news:publication_date><news:title>${escapeXml(title)}</news:title></news:news></url>\n`;
  });

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    rows.join('') + '</urlset>\n',
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
