import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Dedicated Playwright config for the accessibility gate (CHOS-404).
 *
 * Separate from playwright.config.ts (the smoke crawl) so the two can run + fail
 * independently and the a11y spec in `playwright/` is not swept up by the smoke
 * crawl's `./e2e` testDir. It reuses the same auth setup (logs in once, persists
 * the cookie session) so the gate can exercise the protected routes too.
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3003';
const AUTH_FILE = path.join(__dirname, 'e2e/.auth/user.json');

export default defineConfig({
  testDir: '.',
  outputDir: './playwright/test-results',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright/a11y-report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    channel: process.env.PW_BROWSER_CHANNEL || 'chrome',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    // Reuse the smoke crawl's login setup to obtain a session for portal routes.
    { name: 'setup', testMatch: /e2e\/auth\.setup\.ts$/ },
    {
      name: 'a11y',
      testMatch: /playwright\/a11y\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
