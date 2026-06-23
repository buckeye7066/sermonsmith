import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Web unit tests. Pure logic (lib/) runs in the default node environment;
// component tests opt into jsdom per-file via `// @vitest-environment jsdom`.
// The react plugin gives JSX the automatic runtime (no `import React` needed),
// and the `@` alias mirrors vite.config.js so specs import app modules the same
// way the app does.
export default defineConfig({
  plugins: [react()],
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
