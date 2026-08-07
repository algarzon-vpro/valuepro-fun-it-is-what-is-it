import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@it-is-what-is-it/shared': path.resolve(root, '../shared/src/index.ts'),
    },
  },
  build: {
    // Avoid lightningcss native binaries (breaks Linux CI when lockfile is Darwin-generated)
    cssMinify: 'esbuild',
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
