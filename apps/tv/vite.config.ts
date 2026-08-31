import { defineConfig } from 'vite';

import { webIconPlugin } from './webIconPlugin.js';

export default defineConfig({
  plugins: [webIconPlugin()],
  base: './',
  cacheDir: '../../.tools/vite/tv',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    // The player is a separate on-demand chunk; the initial viewer remains below 300 kB.
    chunkSizeWarningLimit: 600,
  },
});
