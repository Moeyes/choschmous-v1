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
- [ ] CHOS-406 — email worker (templates) + in-app notification inbox + bulk athlete import; FE modules/import + notifications UI
- [ ] CHOS-407 — pin Next to stable GA; Lighthouse CI budgets + bundle-analyzer gate

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

### Pre-existing issues found (NOT mine — own under later tickets)
- `frontend/src/proxy.ts:55` uses `request.ip` which Next 16 removed → tsc error.
  Belongs to CHOS-303/407 (build green). Fix under **CHOS-407**. (next.config.ts
  cleanup for this is staged-but-deferred to the 407 commit.)
- `frontend/src/modules/sports/schema/sports.schema.test.ts` — 2 failing tests
  (`categoryFormSchema` gender) on baseline, untouched by me.
