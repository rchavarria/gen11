import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const webRoot = fileURLToPath(new URL('./src/web', import.meta.url));

export default defineConfig({
  root: webRoot,
  base: '/gen11/',
  plugins: [react()],
  test: {
    dir: fileURLToPath(new URL('./src', import.meta.url)),
    environment: 'node',
    setupFiles: [fileURLToPath(new URL('./src/web/test/setup.js', import.meta.url))],
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
});
