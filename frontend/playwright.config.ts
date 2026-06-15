import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Playwright config for the MoEYS portal smoke crawl.
 *
 * Goal: visit every route in the app and surface "gaps" — pages that crash,
 * log console errors, throw uncaught exceptions, return HTTP 4xx/5xx, redirect
 * unexpectedly, or render blank.
 *
 * Env vars:
 *   E2E_BASE_URL   default http://localhost:3003 (the `next dev -p 3003` server)
 *   E2E_USERNAME   login for the protected (portal) routes — e.g. `admin`
 *   E2E_PASSWORD   login password (the SEED_DEFAULT_PASSWORD used by seed.py)
 *   E2E_EVENT_ID / E2E_SPORT_ID / E2E_ENROLL_ID  sample ids for dynamic routes
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3003';

export const AUTH_FILE = path.join(__dirname, 'e2e/.auth/user.json');

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  // One worker keeps the crawl gentle on a single dev backend and makes the
  // screenshot/console output read top-to-bottom.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    // Use the system-installed Google Chrome. Playwright has no bundled browser
    // build for newer distros (e.g. Ubuntu 26.04). Once `pnpm e2e:install`
    // works for your OS, set PW_BROWSER_CHANNEL=chromium to use the bundled one.
    channel: process.env.PW_BROWSER_CHANNEL || 'chrome',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // Generous nav timeout: first-hit dev compilation can be slow.
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    // 1) Log in once via the real UI and persist the cookie session.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // 2) Crawl every route using that session (protected routes are skipped
    //    automatically when no credentials are provided).
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
    },
  ],
  // Reuse the already-running dev server if there is one; otherwise start it.
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
