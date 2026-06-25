# @moeys/ui — design-system workspace (CHOS-405)

Storybook + Chromatic for the shared UI primitives that live in
[`../../src/shared/ui`](../../src/shared/ui). Each primitive has a story, every
story is checked with **axe-core** (accessibility), and Chromatic provides visual
regression on every push.

This package does **not** copy the components — the stories import them straight
from the app via the same `@/…` alias the app uses (configured in
`.storybook/main.ts`). The app stays the single source of truth; Storybook is a
lens onto it, so a story can never drift from what ships.

## Commands

```bash
cd frontend/packages/ui
pnpm install            # installs the Storybook/Chromatic toolchain (needs network)
pnpm storybook          # local dev at http://localhost:6006
pnpm build-storybook    # static build → storybook-static/
pnpm test-a11y          # axe gate over every story (needs a running storybook)
pnpm chromatic          # publish to Chromatic (needs CHROMATIC_PROJECT_TOKEN)
```

## Why this is a stand-alone install (not in the root pnpm workspace)

The Storybook + Chromatic toolchain is large. Folding it into the root
`frontend` workspace would force the main `frontend` CI job's
`pnpm install --frozen-lockfile` to carry the whole toolchain and would require
regenerating the root lockfile. That is the same constraint CHOS-404 hit with
`@axe-core/playwright`, and we resolve it the same way: keep the heavy,
gate-only toolchain **out** of the main lockfile and install it in a dedicated CI
job (`.github/workflows/chromatic.yml`) that `cd`s here and runs a normal
networked install.

`../../pnpm-workspace.yaml` documents the deferred `packages/*` glob. Fold this
package into the root workspace once the Storybook toolchain can be added to the
committed root lockfile (i.e. when CI/network policy allows regenerating it).

## a11y (stories + axe per component)

- `.storybook/preview.tsx` enables `@storybook/addon-a11y` with `a11y.test:
  'error'`, so violations surface in the Storybook panel during development.
- `.storybook/test-runner.ts` injects axe and runs `checkA11y` on every story
  for **WCAG 2.1 A/AA**, turning the checks into a CI gate (`pnpm test-a11y`).
  This is the component-level complement to CHOS-404's route-level a11y gate.

## Chromatic — credentials needed (TODO: live infra)

The Chromatic CI job is gated on a `CHROMATIC_PROJECT_TOKEN` repository secret.
Until it is set the job is a **no-op** (it logs a notice and exits 0), so the
pipeline is green before the Chromatic project exists.

1. Create a project at https://www.chromatic.com (link the GitHub repo).
2. Copy the project token.
3. Add it as the `CHROMATIC_PROJECT_TOKEN` GitHub Actions secret.

No other infrastructure is required; Chromatic builds the static Storybook and
hosts the snapshots.
