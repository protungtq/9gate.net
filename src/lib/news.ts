export const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isNewsArticle(slug: string, type?: string) {
  return slug !== 'chao-mung-game8vn' && type?.trim().toLowerCase() !== 'hướng dẫn';
}

export function articleDate(value?: string | Date) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function articleDateMetadata(value?: string | Date) {
  const date = articleDate(value);
  if (!date) return undefined;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return date.toISOString();
}
