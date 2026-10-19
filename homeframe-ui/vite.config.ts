import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { homeframe } from '@builtbyted/homeframe/vite';
import config from './homeframe.config.js';

const backend = process.env.STUDIO_BACKEND ?? 'http://127.0.0.1:18080';
export default defineConfig({
  plugins: [homeframe(config), react()],
  server: {
    port: 5177,
    strictPort: true,
    proxy: Object.fromEntries(
      [
        '/api',
        '/openai',
        '/ollama',
        '/ws',
        '/oauth',
        '/static',
        '/cache',
        '/health',
        '/pyodide',
      ].map((path) => [path, { target: backend, changeOrigin: false, ws: path === '/ws' }]),
    ),
  },
  build: { target: 'es2022', sourcemap: true },
});
