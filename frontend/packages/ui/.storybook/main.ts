import type { StorybookConfig } from '@storybook/react-vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// The shared UI primitives live in the Next app (../../src/shared/ui). Stories
// import them via the same `@/…` alias the app uses, so the components are
// exercised exactly as shipped (no fork/copy that could drift from production).
const appSrc = resolve(here, '../../../src');

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    // CHOS-405: runs axe-core against every story on render and reports
    // violations in the Storybook a11y panel; the test-runner (test-storybook)
    // turns the same checks into a CI gate. "stories + axe per component".
    '@storybook/addon-a11y',
  ],
  framework: { name: '@storybook/react-vite', options: {} },
  typescript: {
    // The app is the source of truth for types; don't fail the Storybook build
    // on app-level type quirks — the `frontend` CI job already type-checks them.
    check: false,
  },
  async viteFinal(viteConfig) {
    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias ?? {}),
      '@': appSrc,
    };
    return viteConfig;
  },
};

export default config;
