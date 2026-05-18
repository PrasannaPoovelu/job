import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The repo is served from https://<user>.github.io/job/ on GitHub Pages,
// so production builds need a `/job/` base. Local dev keeps `/` so links and
// `vite preview` still work the way you'd expect.
//
// If you fork the repo under a different name, update this constant.
const PROD_BASE = '/job/';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? PROD_BASE : '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
