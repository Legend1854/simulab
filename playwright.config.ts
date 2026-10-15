import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * End-to-end tests run against the production build served by `vite preview`.
 * Browsers: install with `npx playwright install chromium` (one-off, about 150 MB).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
