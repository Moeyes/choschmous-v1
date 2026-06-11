---
name: superadmin-role-gate-bug
description: Recurring frontend bug — role === UserRole.ADMIN gates exclude super_admin, contradicting FEATURE_ACCESS
metadata:
  type: project
---

Many MoEYS frontend components gate admin-only UI with `role === UserRole.ADMIN`, which **excludes `super_admin`**. This contradicts `core/auth/types/index.ts` `FEATURE_ACCESS`, where SUPER_ADMIN is meant to access every feature. Correct fix: use `const { hasRole } = useAuth();` + `hasRole([UserRole.ADMIN, UserRole.SUPER_ADMIN])` (the `useAuth` context exposes `hasRole`/`canAccess`).

**Why:** super_admin users silently lose create/edit/delete/assign controls across the app.
**How to apply:** when touching any component, check its role gate and switch ADMIN-only checks to `hasRole([ADMIN, SUPER_ADMIN])`.

Fixed so far (2026-06-03): EventSportManager, EventSportOrgManager, SportList, CategoryList.
Still ADMIN-only (need fixing): `modules/cards/components/CardGrid.tsx`, `modules/organizations/components/OrgList.tsx`, `modules/reports/components/ReportList.tsx`, `modules/registration/components/ParticipantList.tsx`, `modules/participation/components/ParticipationList.tsx`, `modules/participation/components/ParticipationPage.tsx`.

Related: backend should also enforce admin+super_admin server-side on these mutations (UI gates are cosmetic). See [[sports-crud-and-minimal-fields]].
