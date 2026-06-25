import type { TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

/**
 * CHOS-405: turns the per-story axe checks into a CI gate.
 *
 * `test-storybook` visits every story in a headless browser; for each one we
 * inject axe-core and fail the run on any violation. This mirrors the app-level
 * a11y gate from CHOS-404 (@axe-core/playwright over every route) but at the
 * component level, so regressions are caught before they ever reach a page.
 */
const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page) {
    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: { html: true },
      // WCAG 2.1 A/AA — the same ruleset the route-level gate enforces.
      axeOptions: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      },
    });
  },
};

export default config;
