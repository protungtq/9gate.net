# 9Gate

Blog game cá nhân, nơi lưu góc nhìn, ghi chép và những game đáng để thử.

## Cấu trúc

- `src/data/games.json` — Danh mục game (icon, cover, trailer, mô tả, SEO)
- `src/pages/index.astro` — Trang chủ lưới game
- `src/pages/game/[slug].astro` — Chi tiết game + bài viết liên quan
- `src/pages/cap-nhat/[...page].astro` — Danh sách bài viết
- `src/pages/p/[slug].astro` — Chi tiết bài viết
- `src/content/posts/` — Bài viết Markdown (frontmatter có field `game: "slug"`)
- `public/tools/games.html` — Tool quản lý game (thêm/sửa/xóa, đẩy lên GitHub)

## Quản lý game

Mở `/tools/cms/` để quản lý game, soạn bài, nhập Markdown hoặc khôi phục bản nháp đã lưu trên trình duyệt. Các đường dẫn cũ `/tools/gamehub-cms/` và `/tools/gamehub-cms.html` chuyển hướng đến đây.

Điền Worker Proxy, repo và nhánh xuất bản của 9Gate trong mục Kết nối. Worker cần hỗ trợ các tham số `repo` và `branch` cho thao tác đọc, ghi và xóa trên GitHub. Có thể dùng `/tools/games.html` để quản lý riêng danh mục game.

Trình soạn hỗ trợ dán văn bản định dạng, chèn YouTube, tải và rehost ảnh qua Worker. Worker nhận biểu mẫu `multipart/form-data` ở URL gốc với `destination=image-host` và `provider=imgbb` hoặc `provider=freeimage`. Cấu hình khóa nhà cung cấp ở Worker. Biên tập AI dùng endpoint `/gemini-rewrite` tương thích Blog8 và đưa kết quả vào một ô đề xuất để duyệt trước khi thay nội dung.

## Deploy

Cloudflare Pages dùng `npm run build` và thư mục đầu ra `dist`. Đặt tên miền chính thức tại trường `site` trong `astro.config.mjs` rồi build lại khi đổi domain. Các URL canonical, Open Graph, JSON-LD, sitemap, robots.txt, llms.txt và địa chỉ hiển thị trong CMS dùng thiết lập này.

Khi chuyển 9Gate sang domain gốc, gắn `9gate.net` vào Pages và cấu hình Cloudflare Redirect Rule với điều kiện `http.host eq "www.9gate.net"`. Dùng đích động `concat("https://9gate.net", http.request.uri.path)`, mã `301` và bật giữ query string. Áp dụng rule khi domain gốc đã phục vụ bản mới.
