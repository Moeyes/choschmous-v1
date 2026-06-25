import type { Preview } from '@storybook/react';
import './storybook.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app', value: 'hsl(0 0% 97%)' },
        { name: 'card', value: 'hsl(0 0% 100%)' },
        { name: 'dark', value: 'hsl(201 30% 12%)' },
      ],
    },
    // CHOS-405: every story is checked with axe-core; flag (don't silently
    // pass) any violation. The CI test-runner promotes these to a hard gate.
    a11y: {
      test: 'error',
    },
  },
  initialGlobals: {
    backgrounds: { value: 'app' },
  },
};

export default preview;
