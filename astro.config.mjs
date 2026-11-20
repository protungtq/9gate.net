import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  // Tên miền chính thức dùng cho metadata và sitemap.
  site: 'https://9gate.net',
  integrations: [tailwind({ applyBaseStyles: false })],
  output: 'static',
});
