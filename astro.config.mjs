import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { parse, serializeOuter } from 'parse5';

const followedDomains = ['game8.info', 'vuivui.org'];

function externalLinks() {
  return {
    name: '9gate-external-links',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const site = new URL('https://9gate.net');
        let changed = 0;

        for (const file of await readdir(dir, { recursive: true, withFileTypes: true })) {
          if (!file.isFile() || !file.name.endsWith('.html')) continue;
          const path = file.parentPath + '/' + file.name;
          const html = await readFile(path, 'utf8');
          const document = parse(html, { sourceCodeLocationInfo: true });
          const edits = [];
          const nodes = [document];

          while (nodes.length) {
            const node = nodes.pop();
            if (node.childNodes) nodes.push(...node.childNodes);
            if (node.content) nodes.push(node.content);
            const tag = node.sourceCodeLocation?.startTag;
            if (node.tagName !== 'a' || !tag) continue;

            const href = node.attrs.find(attr => attr.name === 'href')?.value;
            if (!href) continue;
            let url;
            try {
              url = new URL(href, site);
            } catch {
              continue;
            }
            if (!['http:', 'https:'].includes(url.protocol)) continue;
            const host = url.hostname.replace(/[.]$/, '');
            if (host === site.hostname || host === 'www.' + site.hostname) continue;

            const follow = followedDomains.some(domain => host === domain || host.endsWith('.' + domain));
            const rel = new Set((node.attrs.find(attr => attr.name === 'rel')?.value ?? '')
              .toLowerCase().split(/\s+/).filter(Boolean));
            rel.delete('opener');
            rel.add('noopener');
            if (follow) rel.delete('nofollow');
            else rel.add('nofollow');

            const attrs = node.attrs.filter(attr => attr.name !== 'target' && attr.name !== 'rel');
            attrs.push({ name: 'target', value: '_blank' }, { name: 'rel', value: [...rel].join(' ') });
            const opening = serializeOuter({ ...node, attrs, childNodes: [] }).slice(0, -4);
            if (html.slice(tag.startOffset, tag.endOffset) !== opening) edits.push({ ...tag, opening });
          }

          if (!edits.length) continue;
          let offset = 0;
          const parts = [];
          for (const edit of edits.sort((a, b) => a.startOffset - b.startOffset)) {
            parts.push(html.slice(offset, edit.startOffset), edit.opening);
            offset = edit.endOffset;
          }
          await writeFile(path, parts.join('') + html.slice(offset));
          changed += edits.length;
        }
        logger.info(`Updated ${changed} external links.`);
      },
    },
  };
}

export default defineConfig({
  // Tên miền chính thức dùng cho metadata và sitemap.
  site: 'https://9gate.net',
  integrations: [tailwind({ applyBaseStyles: false }), externalLinks()],
  output: 'static',
});
