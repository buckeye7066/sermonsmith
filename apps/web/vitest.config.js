import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Web unit tests. Pure logic (lib/) runs in the node environment — no DOM
// needed. The `@` alias mirrors vite.config.js so specs can import app modules
// the same way the app does.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
