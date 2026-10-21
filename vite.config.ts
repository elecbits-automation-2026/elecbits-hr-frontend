import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite config. The aliases mirror tsconfig `paths` — both must list the same
 * entries or imports resolve in the editor but fail in the build (or vice
 * versa). Tailwind v4 runs as a Vite plugin; there is no tailwind.config.js.
 */
const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@components': src('components'),
      '@constants': src('constants'),
      '@hooks': src('hooks'),
      '@insights': src('insights'),
      '@layouts': src('layouts'),
      '@pages': src('pages'),
      '@providers': src('providers'),
      '@routes': src('routes'),
      '@services': src('services'),
      '@store': src('store'),
      '@app-types': src('types'),
      '@utils': src('utils'),
    },
  },
  server: {
    port: 5173,
  },
});
