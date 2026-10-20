import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { homeframe } from '@builtbyted/homeframe/vite';
import config from './homeframe.config.js';

const upstream = resolve(import.meta.dirname, '../build');
async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]))).flat();
}

export default defineConfig({
  publicDir: false,
  plugins: [homeframe(config), react(), {
    name: 'studio-original-interface',
    async generateBundle() {
      for (const file of await files(upstream)) {
        const name = relative(upstream, file);
        // The original backend serves shared static/Python resources. New Svelte
        // chunks are copied exactly; its controls and route modules are unchanged.
        if (['index.html', 'manifest.json', 'README.md', 'BRANDING.md'].includes(name) || (name.startsWith('static/') && !['static/loader.js', 'static/custom.css'].includes(name)) || name.startsWith('pyodide/')) continue;
        this.emitFile({ type: 'asset', fileName: name, source: await readFile(file) });
      }
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        const original = await readFile(resolve(upstream, 'index.html'), 'utf8');
        const head = original.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
        const body = original.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
        return html.replace('<!-- STUDIO_UPSTREAM_HEAD -->', head.replace(/<title>[\s\S]*?<\/title>/i, ''))
          .replace('<!-- STUDIO_UPSTREAM_BODY -->', body);
      },
    },
  }],
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1200 },
});
