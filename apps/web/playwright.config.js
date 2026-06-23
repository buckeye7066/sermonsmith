import { defineConfig, devices } from '@playwright/test';

// E2E smoke config. Builds + serves the production bundle via `vite preview`
// and drives it with headless Chromium. The smoke is backend-independent — it
// verifies the SPA boots, mounts, and routes to the auth screen without a live
// API, which is exactly the class of regression (bad build, broken router, a
// dependency upgrade like react-router-dom) that the unit tests can't catch.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
