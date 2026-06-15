import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { ROUTES, type RouteDef } from './routes';

const hasCreds = !!(process.env.E2E_USERNAME && process.env.E2E_PASSWORD);
const SHOTS_DIR = path.join(__dirname, 'screenshots');

/**
 * Console messages that are noise rather than real defects. Tune this list as
 * you learn your app's baseline (e.g. third-party warnings you can't fix).
 */
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /favicon\.ico/i,
];

function isIgnored(text: string) {
  return IGNORED_CONSOLE.some((re) => re.test(text));
}

/** The Next.js dev error overlay / runtime crash markers. */
async function hasErrorOverlay(page: Page) {
  const markers = [
    page.locator('nextjs-portal'),
    page.getByText('Unhandled Runtime Error', { exact: false }),
    page.getByText('Application error', { exact: false }),
    page.getByText("This page isn't working", { exact: false }),
  ];
  for (const m of markers) {
    if (await m.count()) return true;
  }
  return false;
}

for (const route of ROUTES) {
  test(`${route.group} · ${route.name}  →  ${route.path}`, async ({ page }, testInfo) => {
    test.skip(
      route.requiresAuth && !hasCreds,
      'Protected page — set E2E_USERNAME/E2E_PASSWORD and run the backend.',
    );

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const badResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('response', (res) => {
      const status = res.status();
      if (status >= 400) {
        badResponses.push(`${status} ${res.request().method()} ${res.url()}`);
      }
    });

    // --- Visit the page ---
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const landedPath = new URL(page.url()).pathname;

    // Always capture a screenshot so you can eyeball every page at once.
    const shot = path.join(SHOTS_DIR, `${route.group}-${route.name}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    await testInfo.attach('screenshot', { path: shot, contentType: 'image/png' });

    // --- Gap checks (soft, so one page reports ALL its problems) ---

    // 1) The document itself must not be a server error.
    const docStatus = response?.status() ?? 0;
    expect
      .soft(docStatus, `document HTTP status for ${route.path}`)
      .toBeLessThan(500);

    // 2) A protected page must not silently bounce us to /login (that means the
    //    session/credentials/backend are broken).
    if (route.requiresAuth) {
      expect
        .soft(landedPath, `"${route.path}" unexpectedly redirected to ${landedPath}`)
        .not.toMatch(/^\/login/);
    }

    // 3) No runtime crash overlay.
    expect
      .soft(await hasErrorOverlay(page), `runtime error overlay on ${route.path}`)
      .toBe(false);

    // 4) Page rendered something — not a blank screen.
    const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
    expect
      .soft(bodyText.trim().length, `visible text on ${route.path} (blank page?)`)
      .toBeGreaterThan(0);

    // 5) No uncaught JS exceptions.
    expect
      .soft(pageErrors, `uncaught exceptions on ${route.path}`)
      .toEqual([]);

    // 6) No console errors.
    expect
      .soft(consoleErrors, `console errors on ${route.path}`)
      .toEqual([]);

    // Attach a readable gap report for this page (visible in the HTML report).
    const report = [
      `route:        ${route.path}`,
      `landed on:    ${landedPath}`,
      `doc status:   ${docStatus}`,
      `dynamic:      ${route.dynamic ? 'yes (missing record => not-found is OK)' : 'no'}`,
      '',
      `page errors (${pageErrors.length}):`,
      ...pageErrors.map((e) => `  - ${e}`),
      '',
      `console errors (${consoleErrors.length}):`,
      ...consoleErrors.map((e) => `  - ${e}`),
      '',
      `failed responses (${badResponses.length}):`,
      ...badResponses.map((e) => `  - ${e}`),
    ].join('\n');
    await testInfo.attach('gap-report', { body: report, contentType: 'text/plain' });
  });
}
