# Project Memory

- [National hardening initiative](national-hardening-initiative.md) — 4-phase frontend hardening via national-frontend-architecture skill; P0 audit done, P1 next
- [Repo topology & remotes](repo-topology-and-remotes.md) — 3 nested repos; frontend→Moeyes/frontend main, backend→Moeyes/Backend-V2 (panha diverged, use feature branch)

- [Sports CRUD & minimal fields](sports-crud-and-minimal-fields.md) — sports model is just name_kh+sport_type; PATCH/DELETE routes were missing
- [Super-admin role-gate bug](superadmin-role-gate-bug.md) — `role === UserRole.ADMIN` checks wrongly exclude super_admin across the frontend
