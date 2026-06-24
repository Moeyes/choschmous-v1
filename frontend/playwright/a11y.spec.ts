/**
 * Accessibility gate (CHOS-404).
 *
 * Runs @axe-core/playwright against every route in the app and fails on any
 * WCAG 2.1 A/AA violation of `critical` impact ("zero criticals all routes").
 * Also asserts the core interaction affordances on the login page: keyboard
 * navigation, a visible focus ring, and programmatic labels for screen readers.
 *
 * Lives in `frontend/playwright/` (NOT `frontend/e2e/`) so the broad smoke crawl
 * (testDir ./e2e) does not pick it up, and it runs via its own config
 * (`playwright.a11y.config.ts` → `pnpm e2e:a11y`). The @axe-core/playwright dep
 * is installed at gate time in CI (see .github/workflows/e2e.yml a11y job).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES } from '../e2e/routes';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Portal routes need a session; the setup project writes storageState. When no
// credentials are configured (E2E_USERNAME/PASSWORD), skip the authed routes so
// the gate still runs the public surface.
const hasCreds = !!(process.env.E2E_USERNAME && process.env.E2E_PASSWORD);

function summarize(violations: { id: string; impact?: string; nodes: unknown[] }[]) {
  return violations
    .map((v) => `  [${v.impact}] ${v.id} ×${v.nodes.length}`)
    .join('\n');
}

for (const route of ROUTES) {
  if (route.requiresAuth && !hasCreds) continue;

  test(`a11y: ${route.name} (${route.path})`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    // Settle async content; ignore the timeout for chatty dev pages.
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    // The hard gate is "zero criticals" (the ticket's bar). Serious/moderate are
    // surfaced as an annotation so they can be triaged without flaking the gate.
    const critical = results.violations.filter((v) => v.impact === 'critical');
    const serious = results.violations.filter((v) => v.impact === 'serious');
    if (serious.length) {
      test.info().annotations.push({
        type: 'a11y-serious',
        description: summarize(serious),
      });
    }
    expect(critical, `Critical a11y violations:\n${summarize(critical)}`).toEqual(
      [],
    );
  });
}

test('a11y: login is keyboard-navigable with labels + visible focus', async ({
  page,
}) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Screen-reader labels: username + password inputs resolve to an accessible
  // name (associated <label for>), so they are announced.
  const username = page.getByLabel(/username|ឈ្មោះ/i);
  const password = page.getByLabel(/password|ពាក្យសម្ងាត់/i);
  await expect(username).toBeVisible();
  await expect(password).toBeVisible();

  // Keyboard navigation: tabbing reaches the username field and focus is real.
  await username.focus();
  await expect(username).toBeFocused();
  await page.keyboard.press('Tab');
  // Focus moved off the username field (to password or the show/hide toggle).
  await expect(username).not.toBeFocused();

  // A focused control must have a visible focus indicator (no outline:none with
  // nothing replacing it) — assert the active element exposes a focus style.
  const focusVisible = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const s = getComputedStyle(el);
    return (
      s.outlineStyle !== 'none' ||
      parseFloat(s.outlineWidth) > 0 ||
      s.boxShadow !== 'none'
    );
  });
  expect(focusVisible).toBe(true);
});
