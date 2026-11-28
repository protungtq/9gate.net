import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site, url }) => {
  const sitemap = new URL('/sitemap.xml', site ?? url).href;
  const newsSitemap = new URL('/news-sitemap.xml', site ?? url).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\nSitemap: ${newsSitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
