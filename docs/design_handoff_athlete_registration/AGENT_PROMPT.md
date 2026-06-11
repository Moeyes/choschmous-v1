# AGENT PROMPT — paste this into Claude Code / Cursor

> Run this from the root of your Next.js project, with the `design_handoff_athlete_registration/`
> folder copied somewhere the agent can read (e.g. the repo root). Adjust the **two bracketed
> lines** at the top, then paste the whole thing.

---

You are implementing a high-fidelity design into THIS existing Next.js project.

**Design source:** `./design_handoff_athlete_registration/` — read `README.md` first (full spec,
exact tokens, every screen), then read the prototype in `reference/` (`styles.css`, `data.jsx`,
`ui.jsx`, `steps.jsx`, `app.jsx`, `index.html`). These are **design references**, not code to ship
verbatim — recreate them as idiomatic modules in this project.

**Where it goes in my app:** [e.g. the route `app/register/page.tsx`, replacing the current form].
**My data lives in:** [e.g. `lib/sports.ts` / an API at `/api/...` — or "use the prototype's sample
data for now"].

## Requirements

1. **Stack & structure.** Use this project's conventions (App Router, TypeScript if present).
   Create a `components/registration/` folder. Split the prototype's global-scoped components into
   real modules with `import`/`export` (no `window` globals, no `Object.assign(window, …)`).
   Add `"use client"` to every file that uses hooks/state (the wizard, the UI components, steps).

2. **Icons → `lucide-react`.** Run `npm install lucide-react`. Replace the prototype's custom
   `Icon` component (which reads `window.lucide`) with a typed registry that maps the icon-name
   strings used in the data to imported `lucide-react` components, e.g.:
   ```tsx
   import { Goal, Volleyball, /* …all names listed in README "Assets" … */ Trophy } from "lucide-react";
   const ICONS = { Goal, Volleyball, /* … */ Trophy };
   export function Icon({ name, size = 24, ...p }: { name: keyof typeof ICONS; size?: number }) {
     const C = ICONS[name] ?? Trophy;
     return <C size={size} strokeWidth={2} {...p} />;
   }
   ```
   Keep the data referencing icons by name so swapping data stays trivial.

3. **Fonts → `next/font/google`.** Remove the Google Fonts `<link>`. In `app/layout.tsx` load
   **Public Sans** (weights 400–800) and **Kantumruy Pro** (300–700) as CSS variables and apply
   them on `<html>`. In the CSS set `--font: var(--public-sans), var(--kantumruy), system-ui,
   sans-serif;` so Latin uses Public Sans and Khmer glyphs fall back to Kantumruy Pro.

4. **Styles.** Bring `reference/styles.css` in unchanged as the design system (import it from the
   page, or scope it). **Do not change any token values** (colors, radii, shadows, sizes) — they
   are listed in README → Design Tokens. If this project uses Tailwind or CSS Modules, you may
   port to that, but the rendered result must match the prototype pixel-for-pixel.

5. **Behavior (preserve exactly).** 5-step wizard (Event & Sports → Category → Personal Info →
   Documents → Review) + success screen; clickable stepper with progress fill; per-step validation
   with inline plain-language errors; **working Khmer/English toggle** that translates all UI
   strings AND data labels (Khmer-name fields stay Khmer); multi-select sport grid with search +
   removable chips; drag-&-drop uploads with green "uploaded" state; consent-gated submit that
   shows an application reference. Respect `prefers-reduced-motion`.

6. **SSR safety.** Guard every `localStorage` read/write — initialize state to defaults, then
   hydrate from `localStorage` inside `useEffect` (never during render). Persist `lang`, `step`,
   `maxReached`, and non-file form values.

7. **i18n.** Reuse the prototype's `STR` dictionary + `t(entry, lang)` pattern as a typed module.
   (If this project already uses `next-intl`/`i18next`, wire the same keys into it instead — but
   keep both languages working.)

8. **Data.** Type the domain arrays (events, organizations, sports, categories, genders, ID types,
   roles, nationalities). If I pointed you at real data above, fetch/import from there and map it to
   the same shape (`{ id, icon, km, en, subKm?, subEn? }`); otherwise use the prototype's arrays as
   seed data.

## Acceptance criteria
- Visiting the target route renders the full screen (rail + top bar + wizard) matching the
  prototype at desktop and collapsing correctly on mobile (< 820px → 1 col, < 560px → rail hidden).
- Language toggle flips everything live; refresh restores language + step + form values.
- All five steps validate; can't skip required fields; sports multi-select + uploads + consent
  all work; submit shows the success screen with a reference number.
- No hydration warnings, no `window`/`localStorage` SSR errors, `npm run build` passes,
  TypeScript has no errors.
- No leftover CDN React/Babel/Lucide-UMD script tags.

Work step by step: read the spec and reference files, scaffold the modules, wire it into my route,
then run the build and fix any errors. Ask me only if a routing or data-source decision is genuinely
ambiguous.
