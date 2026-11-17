# 9Gate

Cổng thông tin game Việt Nam — game làm nội dung chính (kiểu Google Play Store), bài viết là vệ tinh trong từng game.

## Cấu trúc

- `src/data/games.json` — Danh mục game (icon, cover, trailer, mô tả, SEO)
- `src/pages/index.astro` — Trang chủ lưới game
- `src/pages/game/[slug].astro` — Chi tiết game + bài viết liên quan
- `src/pages/cap-nhat.astro` — Danh sách bài viết
- `src/pages/p/[slug].astro` — Chi tiết bài viết
- `src/content/posts/` — Bài viết Markdown (frontmatter có field `game: "slug"`)
- `public/tools/games.html` — Tool quản lý game (thêm/sửa/xóa, đẩy lên GitHub)

## Quản lý game

Mở `/tools/games.html` hoặc `/tools/gamehub-cms.html` và điền Worker Proxy cùng repo xuất bản của 9Gate trước khi đẩy nội dung lên GitHub.

## Deploy

Cloudflare Pages dùng `npm run build` và thư mục đầu ra `dist`. Tên miền canonical và sitemap của bản này là `https://www.9gate.net`.
