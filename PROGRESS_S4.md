# Sprint 4 progress — CHOS-401..407

Resumable checklist. On resume: read this + `git log --oneline | grep CHOS-40`, skip done tickets.
Commit per-ticket `CHOS-40X: ...` immediately after each.

Constraints (from brief): code/IaC only, **no live infra** (KMS/SIEM/IdP/Chromatic) →
TODO+cred notes. No behaviour change unless the ticket states it. Tests green.

Environment notes (this machine):
- Network is **offline** — cannot `uv add` new Python deps (cryptography/pyotp/webauthn/
  authlib/casbin all unavailable). Implement with stdlib + already-present libs
  (httpx, pyjwt, arq). KMS/WebAuthn-attestation/OIDC-IdP boundaries are stubbed with
  provider interfaces + TODO+cred notes.
- Backend test DB: `docker compose up -d db redis`; recreate `moeys_test`; `python
  scripts/init_db_schema.py`; `.venv/bin/python -m pytest -q`. Baseline = 171 passed.

## Checklist
- [x] CHOS-401 — MFA (TOTP/WebAuthn) + recovery codes + OIDC login; FE core/auth + login UI
- [x] CHOS-402 — ABAC policy engine (deny-by-default) wired into deps/services + unit tests
- [x] CHOS-403 — field-level PII encryption (KMS envelope) + hash-chained append-only audit log + SIEM ship + tamper test
- [x] CHOS-404 — Playwright a11y (@axe-core) zero criticals + a11y statement + e2e gate
- [x] CHOS-405 — packages/ui workspace pkg + Storybook (+axe) + Chromatic CI; unify Modal/ModalV2
- [x] CHOS-406 — email worker (templates) + in-app notification inbox + bulk athlete import; FE modules/import + notifications UI
- [x] CHOS-407 — pin Next to stable GA; Lighthouse CI budgets + bundle-analyzer gate

## Notes per ticket

### CHOS-401 (done)
- Backend: `src/services/mfa/` (stdlib TOTP `totp.py`, one-time `recovery.py`,
  `webauthn.py` scaffold w/ verify behind a library boundary → 501, `oidc.py`
  authcode+PKCE via httpx+pyjwt, `challenge.py` 5-min signed challenge token,
  `service.py` MfaService). New `user_mfa` table/model + Alembic `d401a1b2c3d4`.
  `auth_service.login` now branches: enrolled→`mfa_required`+challenge token;
  `MFA_ENFORCED` + privileged role + not-enrolled→`mfa_enrollment_required`.
  Routes `/auth/mfa/*` (verify is public, authed by challenge token) + `/auth/oidc/*`.
- Config: `MFA_ENFORCED` defaults **False** (opt-in; enrolled users always
  challenged) so existing accounts/tests aren't locked out. OIDC disabled unless
  `OIDC_*` set. TODO(infra): KMS-encrypt `totp_secret` (CHOS-403), register IdP
  creds, add `webauthn` lib to finish WebAuthn verify.
- Frontend: `core/auth/mfa.ts` (service + `MfaRequiredError`), `loginUser` throws
  it on challenge, `AuthContext.completeMfa`, `useLogin` exposes
  `mfaChallenge`/`submitMfa`/`cancelMfa`, LoginForm renders the 2nd-factor step.
  i18n keys added en+kh.
- Tests: `tests/test_mfa.py` 8 new (unit TOTP/recovery + integration login flow +
  enforcement). Backend 179 passed. FE auth vitest green; tsc clean for my files.

### CHOS-402 (done)
- `app/domain/policies/`: self-contained ABAC engine (no OPA-server/Casbin dep —
  offline + must be unit-testable/versioned). Vocabulary: Subject(role,org,sport),
  Resource(kind,org,sport,review_state,data_class,owner), Action (capability +
  CRUD), DataClass, ReviewState. `engine.py` = **deny-by-default + deny-overrides**.
  `rules.py` reproduces deps.py RBAC exactly (capability rules ABSTAIN for
  super_admin so its allow-all isn't clobbered by deny-overrides).
- Wired into `src/database/deps.py`: `require_admin`→MANAGE_GLOBAL,
  `require_superadmin`→ADMINISTER, `require_staff`→STAFF, `enforce_org_access`→
  org-scoped READ, new `require_pii_reveal`→REVEAL_PII+RESTRICTED_PII (used by the
  participant reveal route). All HTTP messages/codes preserved.
- Tests: `tests/test_policies.py` (27) assert engine==old RBAC truth table +
  deny-by-default. Full backend suite **206 passed** (no behaviour change).
- TODO(infra, optional): OPA adapter behind the same `authorize()` if a central
  PDP is later mandated; this engine stays the fail-closed in-process fallback.

### CHOS-403 (done)
- `app/infrastructure/db/crypto.py`: envelope encryption — KMS provider boundary
  (`LocalKms` dev / `AwsKmsProvider` TODO-stub) + `PiiCipher` (per-value random
  DEK wrapped by KEK). **Offline constraint**: no `cryptography`/AES available →
  the local AEAD is a stdlib HMAC-CTR encrypt-then-MAC cipher (documented; prod
  swaps to AES-GCM + AWS KMS behind the same API). `EncryptedString` TypeDecorator
  = transparent encrypt-on-write/decrypt-on-read; legacy plaintext (no `kms1:`
  marker) passes through so no forced backfill.
- Applied to `Enroll.phonenumber` (+ new `Enroll.national_id`) and
  `UserMfa.totp_secret` (closes the 401 TODO). Phone dropped from the plaintext
  `search_text` computed index. Masking + audited reveal UNCHANGED (ORM reads
  decrypt transparently — verified).
- Hash-chained append-only `audit_log`: `prev_hash`/`row_hash` columns,
  `AuditLogWriter.append` (advisory-lock-serialised chain) + `verify_chain`,
  `siem.py` best-effort shipper (gated, never blocks txn). Migration adds an
  append-only DB trigger (UPDATE/DELETE → RAISE).
- Migration `d403a1b2c3d4`: idempotent/delta-only; **reversibility PROVEN** on a
  scratch DB (up→down→up: phone 100↔255, national_id, totp 64↔255, chain cols,
  search_text phone-toggle, trigger). Trigger verified to block UPDATE/DELETE.
- Tests: `test_pii_encryption.py` (round-trip, ciphertext-at-rest vs plaintext-
  via-ORM, auth/tamper, reveal unchanged) + `test_audit_chain.py` (chain links,
  content-tamper detected, deletion detected). Full backend suite **215 passed**.
- Config: `PII_ENCRYPTION_KEY` required in non-local (no dev-key fallback);
  derived from JWT secret in local/CI. SIEM off by default. TODO(infra): inject
  KMS key/creds + SIEM endpoint+token from Vault; swap to AES-GCM/boto3.

### CHOS-404 (done)
- `frontend/playwright/a11y.spec.ts`: @axe-core/playwright over every route in
  `e2e/routes.ts`, fails on any `critical` WCAG 2.1 A/AA violation; serious ones
  annotated. Plus a login keyboard-nav / visible-focus / SR-label test.
- Dedicated `playwright.a11y.config.ts` (reuses the auth setup; testDir spans
  setup + the `playwright/` dir so the smoke crawl doesn't sweep it up). Script
  `e2e:a11y`. Gate added to `e2e.yml` after the smoke crawl.
- **Offline dep handling**: `@axe-core/playwright` can't be installed offline and
  adding it to package.json would break the smoke job's `--frozen-lockfile`
  install. So it is installed at gate time in CI (`pnpm add -D @axe-core/
  playwright@^4.10.0`) and the spec is excluded from `tsconfig` so `tsc`/`next
  build` don't choke on the (locally) unresolved import.
- Accessibility statement page: `/accessibility` (AccessibilityPage, i18n en+kh,
  linked from the home footer; added to the crawl + a11y route list).
- tsc clean for my files (only the pre-existing proxy.ts error remains).

### CHOS-405 (done)
- **Unify Modal/ModalV2**: deleted `shared/ui/ModalV2.tsx`; folded its API
  (sizes xs→xl, built-in `[Cancel][Primary]` confirm footer w/ loading +
  `form`-submit, custom footer) into the single `shared/ui/Modal.tsx`. The
  former Modal's simple `isOpen/onClose/title` call style still works; default
  size `md`=max-w-lg preserves the old Modal default width (was `lg`=max-w-lg).
  Migrated all 7 ModalV2 call sites to `Modal` (sizes preserved 1:1 since the
  scale was inherited). `index.ts` exports `ModalSize` (was `ModalV2Size`). No
  original-Modal call site passes `size`, so the renamed scale is invisible to
  them. tsc clean (only the pre-existing proxy.ts error); vitest 99 pass / 2
  pre-existing fails.
- **packages/ui (@moeys/ui)**: Storybook-react-vite design-system package.
  Stories import the real primitives from `../../src/shared/ui` via a `@/` vite
  alias (no fork — can't drift). Stories for Button/Badge/Input/Modal/Select.
  `addon-a11y` (`a11y.test:'error'`) + `.storybook/test-runner.ts` (axe-playwright,
  WCAG 2.1 A/AA) = "stories+axe per component" as both a panel and a CI gate.
  Tailwind v4 via `.storybook/storybook.css` (imports app globals + `@source`).
- **Offline/lockfile handling** (same pattern as 404): packages/ui is a
  stand-alone package, intentionally NOT in the root pnpm-workspace glob (kept
  commented in `pnpm-workspace.yaml`), so the main `frontend` job's
  `--frozen-lockfile` install is untouched. Its toolchain is installed only by
  the new `chromatic` CI job (`cd packages/ui && pnpm install`). `packages/`
  excluded from app `tsconfig` + `eslint` so `pnpm build`/`lint` ignore it.
- **Chromatic CI** (`.github/workflows/chromatic.yml`): builds Storybook, runs
  the axe a11y gate, then publishes to Chromatic — **no-op until
  `CHROMATIC_PROJECT_TOKEN` secret is set** (logs a notice, exits 0). TODO(infra):
  create the Chromatic project + add the token (see packages/ui/README.md).
- Did NOT verify the Storybook/Chromatic build locally (heavy toolchain, offline
  pattern) — like other CI gates it may need first-run tuning; structure + deps
  are pinned to the app's versions.

### CHOS-406 (done)
- **Email worker** `backend/app/workers/email/`: `templates.py` (registration_
  confirmation + review_outcome, stdlib str-format, HTML-escaped), `sender.py`
  (EmailSender protocol + SmtpEmailSender via stdlib smtplib + LoggingEmailSender
  no-op default), `worker.py` (`send_email_job` + `EmailWorkerSettings`).
  `send_email_job` also registered on the report worker's functions so one worker
  serves both. `enqueue_email()` added to `app/workers/queue.py` (best-effort,
  swallows Redis-down). Config: EMAIL_ENABLED off by default (no-op sender) +
  SMTP_*/EMAIL_FROM/PUBLIC_APP_URL. TODO(infra): provision SMTP relay + inject
  creds (Vault); EMAIL_ENABLED stays off until then so nothing leaves the box.
- **In-app inbox**: `notifications` table/model + migration `d406a1b2c3d4`
  (idempotent/delta-only, head d403→d406), `NotificationService`,
  `schemas/notification.py`, routes `/notifications` (list/unread-count/
  {id}/read/read-all — all scoped to current_user). `notification_dispatch.py`
  orchestrates in-app + email, FULLY best-effort (guards None ids, never
  propagates) — wired into create_participant (registration_confirmation → the
  registrar) and participation review approve/reject (review_outcome → reviewed
  org's users). No behaviour change to those endpoints (dispatch is post-commit,
  wrapped).
- **Bulk import**: `routes/imports.py` (GET template / POST validate dry-run /
  POST commit), `import_service.BulkAthleteImporter` parses .xlsx (openpyxl) and
  runs each row through the SAME validate_registration / RegisterParticipant path
  (no rule bypass); per-row error report (`schemas/import_athlete.py`). Template
  header = recognized field keys (round-trips) with human labels as cell comments.
  Org users forced to own org. 5 MB cap.
- **Frontend**: `modules/notifications` (NotificationBell dropdown in TopBar:
  unread badge + poll, list, mark-read on click + mark-all-read) and
  `modules/import` (ImportPage: event/org/sport/category selectors reusing
  registration's useCascadingData/useCategories + file upload + validate/import +
  ImportReportTable). New route `/import` + sidebar link + `import` FEATURE_ACCESS
  (SUPER_ADMIN/ADMIN/ORGANIZATION) + i18n en+kh (notifications, import, nav).
  endpoints.ts + queryKeys.ts extended.
- Tests: `test_notifications.py` (service+routes+isolation), `test_email_worker.py`
  (templates/sender/job, html-escape), `test_bulk_import.py` (parse/dry-run
  report/commit). Backend suite **238 passed** (215 + 23). FE tsc clean (only the
  pre-existing proxy.ts error), vitest 99 pass / 2 pre-existing fails, eslint
  clean on new files. ruff clean on my files (note: main carries pre-existing
  ruff format/lint drift in unrelated files — left untouched).

### CHOS-407 (done)
- **Pin Next to GA**: `next` `16.3.0-preview.3` → **`16.2.9`** (the registry
  `latest`/GA in the 16.x line) in package.json + lockfile updated (lockfile diff
  is ONLY next + @next/swc-* binaries — no eslint/other dep drift). `pnpm build`
  **green** (all 31 routes compiled, incl. /import).
- **proxy.ts**: the old origin-lock/auth middleware that read `request.ip`
  (removed in Next 16) is dropped; the active `proxy()` keeps only the cookie
  auth-guard. Clears the long-standing tsc error. next.config.ts: removed the
  bogus `experimental.serverExternalPackages` block; added env-driven
  `distDir` (defaults `.next`) so CI/local builds can use a scratch dir.
- **Bundle gate**: `scripts/check-bundle-size.mjs` sums client JS under
  `${distDir}/static` and fails over `BUNDLE_MAX_BYTES` (default 3 MB; baseline
  measured **2.17 MB raw / 0.67 MB gzip**, ~30% headroom). `pnpm bundle:check` +
  `pnpm analyze` (ANALYZE=true) scripts. eslint override lets `scripts/**` use
  console.
- **Lighthouse CI**: `lighthouserc.json` budgets over the PUBLIC pages (/login,
  /privacy, /accessibility — hermetic, no backend): LCP < 2.0s (error), TBT < 200ms
  (error — the lab proxy for INP < 200ms, which is field-only), CLS/script-size
  (warn). `.github/workflows/lighthouse.yml`: one ANALYZE build → bundle gate +
  analyzer artifact + `lhci autorun` (@lhci/cli gate-installed, Chrome via
  setup-chrome). Lighthouse thresholds may need first-run tuning on the runner
  (same caveat as the CHOS-404 a11y gate).
- Verified: tsc clean (stale `tsconfig.tsbuildinfo` had masked it), build green,
  bundle gate pass + fail-on-tiny-budget proven, vitest 99 pass / 2 pre-existing
  fails. `.gitignore` extended for `.next-*`/`.next_*` scratch dirs.
- **Env note**: local `pnpm build` into the default `.next` is blocked by the
  running Dockerized `moeys-frontend-1` dev server (it owns `.next` as root);
  verified the GA build via `NEXT_DIST_DIR=<scratch>`. CI builds in a clean tree
  so this is local-only.

### Pre-existing issues found (NOT mine)
- `frontend/src/modules/sports/schema/sports.schema.test.ts` — 2 failing tests
  (`categoryFormSchema` gender) on baseline, untouched by me.
- Frontend `pnpm lint` (eslint) carries a large pre-existing error backlog
  (e.g. `react-hooks/incompatible-library` on RHF `watch()` in many untouched
  components) — present on HEAD, not introduced here (my new files lint clean).
- Backend `ruff format`/`ruff check` carry pre-existing drift in unrelated files
  (my files are clean).
