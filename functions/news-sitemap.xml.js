export async function onRequestGet({ next }) {
  const response = await next();
  if (!response.ok) return response;

  const now = Date.now();
  const cutoff = now - 48 * 60 * 60 * 1000;
  // The Astro endpoint emits exactly one escaped, complete URL element per line.
  const xml = (await response.text()).replace(/^  <url>[^\n]*<news:publication_date>([^<]+)<[/]news:publication_date>[^\n]*<[/]url>\n/gm, (row, value) => {
    const published = Date.parse(value);
    return published > cutoff && published <= now ? row : '';
  });

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
