import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { AUTH_FILE } from '../playwright.config';

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

/**
 * Logs in through the real login form once and saves the cookie session to
 * AUTH_FILE, which the `chromium` project reuses for every protected route.
 *
 * If no credentials are provided we still write an empty session file (so the
 * authed project can load) and skip — the smoke crawl will then skip the
 * portal routes instead of failing.
 */
setup('authenticate', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  if (!username || !password) {
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(
      true,
      'Set E2E_USERNAME and E2E_PASSWORD (and run the backend) to crawl protected pages.',
    );
    return;
  }

  await page.goto('/login');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('form button[type="submit"]');

  // Login succeeds when we leave /login (role-based redirect to a portal page).
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});
