import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: './',
  server: { fs: { allow: [path.resolve(here, '..')] } },
  build: { outDir: path.resolve(here, '..', 'dist'), emptyOutDir: true,
    rollupOptions: { input: { main: path.resolve(here, 'index.html'), bench: path.resolve(here, 'bench.html') } } },
});
