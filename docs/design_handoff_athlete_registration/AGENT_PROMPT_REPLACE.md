# AGENT PROMPT — REPLACE the existing registration form

> Use this **instead of `AGENT_PROMPT.md`** when you want the new design to take over the existing
> route and remove the old form. Paste into Claude Code / Cursor from your repo root with the
> `design_handoff_athlete_registration/` folder present. Fill the one bracketed line, then paste.

---

You are **replacing** the existing athlete/participant registration UI in THIS Next.js project with
a new high-fidelity design. The old design must be fully swapped out — same route, brand-new UI.

**Design source:** `./design_handoff_athlete_registration/` — read `README.md` (full spec + exact
tokens), then the prototype in `reference/` (`styles.css`, `data.jsx`, `ui.jsx`, `steps.jsx`,
`app.jsx`). These are design references; recreate them as idiomatic modules — do not ship the HTML
verbatim.

**The existing form to replace:** [e.g. `app/register/page.tsx` + `components/RegisterForm.tsx` — or
write: "find it — it's the current multi-step registration at /register"].

## Do this, in order

1. **Locate the old design FIRST.** Search the repo for the current registration screen and
   everything it owns: the page/route, form + step components, its styles/CSS, helper hooks,
   validation, and any local data. **List what you found and exactly what you'll delete vs. keep —
   and stop for my confirmation before deleting anything.**

2. **Preserve the contract, not the look.** Keep working unchanged: the **route/URL**, the **submit
   behavior** (same API endpoint / server action / payload shape), **auth & layout wrappers**, and
   the **field set the backend expects**. Map the new form's state to the _existing_ submit payload —
   if a field name differs, adapt the new UI to the old contract. **Do not change the backend.**

3. **Build the new UI** exactly per the spec — 5-step wizard (Event & Sports → Category → Personal
   Info → Documents → Review) + success screen, app shell (icon rail + top bar + Khmer/English
   toggle), clickable stepper, multi-select sport grid with search/chips, rich icon dropdowns,
   drag-&-drop uploads, consent-gated submit. Follow these conversions:
   - **`lucide-react`** for icons (run `npm install lucide-react`); replace the prototype's
     `window.lucide` Icon with a typed name→component registry (icon list in README → Assets).
   - **`next/font/google`** for Public Sans + Kantumruy Pro (drop the `<link>`).
   - Split global-scoped prototype components into modules with `import`/`export`; add `"use client"`
     to anything using hooks.
   - Bring `reference/styles.css` in as the design system — **do not alter any token values**
     (colors, radii, shadows, sizes are listed in README → Design Tokens).
   - **Guard all `localStorage`** for SSR (hydrate in `useEffect`, never during render).
   - Reuse the `STR` dictionary + `t(entry, lang)` i18n pattern (or wire the same keys into the
     project's existing i18n lib if one exists — keep both languages live).

4. **Swap it in.** Point the existing route at the new wizard, then **remove the old form's now-dead
   files** (components, styles, hooks, data that nothing else imports). Verify nothing else in the
   app still imports them.

5. **Clean up.** No leftover CDN React/Babel/Lucide-UMD tags. No orphaned old-design files or unused
   CSS. No dead imports.

## Acceptance criteria

- The existing registration route now renders the NEW design (rail + top bar + 5-step wizard),
  matching the prototype on desktop and collapsing correctly on mobile (< 820px → 1 col,
  < 560px → rail hidden).
- **Submit still hits the same backend** with the same payload the old form sent — verify the field
  mapping.
- Language toggle flips everything live; refresh restores language + step + form values.
- Every step validates; required fields can't be skipped; sport multi-select, uploads, and consent
  all work; submit shows the success screen with a reference number.
- The **old form's files are deleted** and nothing imports them; `npm run build` passes; no
  TypeScript errors; no hydration / `localStorage` SSR warnings.

## Guardrails

- **Do not delete anything until you've shown me the removal list and I confirm** (step 1).
- If the new field set and the backend payload don't line up, **stop and ask** rather than changing
  the API.
- Work on a branch (e.g. `redesign/registration`) and keep commits small: (1) add new UI alongside
  old, (2) switch the route, (3) delete old files. That way the swap is easy to review and revert.

Read the spec and reference files, present your plan + removal list, wait for my go-ahead, then
implement, build, and fix any errors.
