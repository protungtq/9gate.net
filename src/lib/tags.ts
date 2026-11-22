// Tiện ích chung cho hệ thống tag của 9Gate — bê y nguyên cách làm của game8.
//
// - tagSlug(): slug hoá y hệt game8 (blog8 src/utils/slugify.js): thường hoá NFD,
//   bỏ dấu, đ → d, ký tự lạ → '-', cắt '-' ở hai đầu. Nhờ vậy "Hướng Dẫn" và
//   "Hướng dẫn" (chỉ khác hoa/thường) chung một trang tag.
// - groupPostsByTag(): gom bài theo slug của tag, nhãn hiển thị lấy theo biến thể
//   xuất hiện nhiều nhất trong nhóm.

export interface TagPost {
  slug: string;
  title: string;
  image: string;
  tag: string;
  tags: string[];
  dateText: string;
  _ts: number;
  gameSlug: string;
}

export interface TagGroup {
  slug: string;
  label: string;
  posts: TagPost[];
}

export function tagSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function mapPost(id: string, data: any): TagPost {
  return {
    slug: id.replace(/\.(md|mdx)$/i, ''),
    title: data.title ?? 'Bài viết',
    image: data.image ?? '',
    tag: data.tags?.[0] || 'Bài viết',
    tags: data.tags ?? [],
    dateText: data.date
      ? new Date(data.date).toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '',
    _ts: data.date ? new Date(data.date).getTime() : 0,
    gameSlug: data.game || '',
  };
}

export function sortPosts(posts: TagPost[]): TagPost[] {
  return posts.sort((a, b) => b._ts - a._ts || a.slug.localeCompare(b.slug));
}

export function groupPostsByTag(posts: TagPost[]): TagGroup[] {
  const bySlug = new Map<string, { labels: Map<string, number>; posts: TagPost[] }>();

  for (const post of posts) {
    for (const label of post.tags) {
      const slug = tagSlug(label);
      if (!slug) continue;
      const group = bySlug.get(slug) ?? { labels: new Map(), posts: [] };
      group.labels.set(label, (group.labels.get(label) ?? 0) + 1);
      if (group.posts.at(-1) !== post) group.posts.push(post);
      bySlug.set(slug, group);
    }
  }

  return [...bySlug.entries()]
    .map(([slug, group]) => {
      const label = [...group.labels.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { slug, label, posts: group.posts };
    })
    .sort((a, b) => b.posts.length - a.posts.length || a.label.localeCompare(b.label, 'vi'));
}

// Tag nổi bật cho thanh chip lọc: top theo số bài, tối đa 20.
// Tag "tải game X" trùng y hệt tập bài với tag tên game "X" nên chỉ giữ tag tên game.
export function featuredGroups<T extends { label: string; posts: unknown[] }>(groups: T[], limit = 20): T[] {
  const keyOf = (label: string) => (label.startsWith('tải game ') ? label.slice('tải game '.length) : label);
  const sorted = [...groups].sort(
    (a, b) =>
      b.posts.length - a.posts.length ||
      (a.label.startsWith('tải game ') ? 1 : 0) - (b.label.startsWith('tải game ') ? 1 : 0) ||
      a.label.localeCompare(b.label, 'vi'),
  );
  const picked: T[] = [];
  const seen = new Set<string>();
  for (const g of sorted) {
    if (picked.length >= limit) break;
    const key = keyOf(g.label);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(g);
  }
  return picked;
}
