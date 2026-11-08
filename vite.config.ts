import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'apps/runtime-web',
  base: './',
  build: { outDir: '../../dist', emptyOutDir: true, target: 'es2022' },
  server: { fs: { allow: [resolve('.')] } },
});
