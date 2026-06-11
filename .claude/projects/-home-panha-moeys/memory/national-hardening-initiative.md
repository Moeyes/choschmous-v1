---
name: national-hardening-initiative
description: Ongoing multi-phase frontend hardening to "national-level" standard, governed by the national-frontend-architecture skill
metadata:
  type: project
---

The MoEYS frontend (`frontend/`) is being hardened to a nation-level standard governed by the skill at `frontend/.claude/skills/national-frontend-architecture/` (Ports & Adapters + strict security/data-governance for citizen/athlete PII, incl. minors). **Skill lives under `frontend/.claude/`, so open the VS Code workspace at `frontend/` for `/skills` to list it** (repo root won't).

**Workflow (non-negotiable, from skill):** plan first → user approves → execute; one concern per change; never mix refactor with features; preserve behavior/styles/routes/i18n keys exactly; no new npm packages; run `tsc --noEmit` after every change; frontend is never a security boundary (every UI gate mirrored server-side).

**4 phases:** P0 audit (done 2026-06-03 → `frontend/docs/PHASE_0_AUDIT.md`); P1 cross-cutting foundations; P2 per-module migration in order `users→organizations→sports→events→registration→participation→reports→dashboard→survey/bynumber/cards` (one module/session, PII-heavy modules get security pass in-migration); P3 lint+mock-adapter+CI lock-in.

**P0 key findings:** no module has ports/adapters/api/schema/mappers/store (all legacy `services/`); 0/14 services Zod-parse responses; full `User` PII cached in `localStorage` (tokens are correctly httpOnly cookies); no `usePermissions()` capability hook; no QueryKeys registry; no CSRF/correlation in apiClient; no `queryClient.clear()` on logout; ~49 `console.*`. Clean: en/kh i18n keys match (564 each), no `dangerouslySetInnerHTML`, no secret `NEXT_PUBLIC_`, `any` effectively absent.

**Open item before P1:** user to add `references/auth-migration.md` to the skill for the cookie/session work (most security-sensitive). See [[superadmin-role-gate-bug]] (the 6 `role === ADMIN` gates excluding super_admin are P0 finding S8) and [[sports-crud-and-minimal-fields]].
