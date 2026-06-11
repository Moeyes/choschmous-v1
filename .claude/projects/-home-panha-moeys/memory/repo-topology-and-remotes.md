---
name: repo-topology-and-remotes
description: Three nested git repos with different remotes/branches; push targets and the panha divergence
metadata:
  type: reference
---

`/home/panha/moeys` is **three independent nested git repos** (each has its own `.git`; NOT submodules, no `.gitmodules`, though the parent tracks the other two as `160000` gitlink pointers):

- **parent** `/home/panha/moeys` → `git@github.com:satpanha/choschmous.git` (branch `main`). Personal account. Tracks frontend/backend as commit pointers only.
- **frontend** `/home/panha/moeys/frontend` → `git@github.com:Moeyes/frontend.git`. Push target: **`main`** (clean fast-forward).
- **backend** `/home/panha/moeys/backend` → `git@github.com:Moeyes/Backend-V2.git`. Local working branch `panha`.

**Backend `panha` has diverged from `origin/panha`** (as of 2026-06-03): origin had 4 teammate commits local didn't have (incl. a `develop` merge + "change middleware"), overlapping the same security files (main.py, events, participant, models/user). So local backend work was pushed to a **new branch `feat/csrf-auth-hardening`** (PR into panha) instead of force-pushing. Don't force-push `panha`.

**Conventions used:** frontend pushed to `main`; backend security/feature work goes to a feature branch + PR. `backend/create_superadmin.py` is gitignored (reads creds from env now) — never commit it; its previously hardcoded super-admin password was exposed in the local working tree and should be rotated (the value is not recorded here). Backend `tests/` and `seed.py` are intentionally left uncommitted. See [[national-hardening-initiative]].
