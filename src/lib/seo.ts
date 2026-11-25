export function absoluteImage(value: string | undefined, base: URL | string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const image = new URL(value, base);
    if (image.protocol === 'https:' || image.protocol === 'http:') return image.href;
  } catch {
    return undefined;
  }
}

export function seoSummary(value: string, limit = 180): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit - 1);
  const end = truncated.lastIndexOf(' ');
  return `${end > limit / 2 ? truncated.slice(0, end) : truncated}…`;
}

export function breadcrumbSchema(base: URL, crumbs: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Trang chủ', path: '/' }, ...crumbs].map(({ name, path }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: new URL(path, base).href,
    })),
  };
}

export function listSchema(base: URL, name: string, entries: { name: string; path: string }[], offset = 0) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: entries.map(({ name, path }, index) => ({
      '@type': 'ListItem',
      position: offset + index + 1,
      name,
      url: new URL(path, base).href,
    })),
  };
}
