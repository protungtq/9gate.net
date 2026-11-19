import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://www.9gate.net',
  integrations: [tailwind({ applyBaseStyles: false })],
  output: 'static',
});
