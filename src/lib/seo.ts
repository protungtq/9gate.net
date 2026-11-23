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
