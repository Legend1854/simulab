import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/** `npm run screenshots` regenerates the README images in docs/screenshots/ from the real app. */
export default defineConfig({
  ...base,
  testDir: 'tests/screenshots',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  projects: [{ name: 'screenshots', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } }],
});
