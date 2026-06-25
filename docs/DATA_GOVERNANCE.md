# Data Governance (CHOS-501)

How the MoEYS national sports-event system classifies, retains, erases, and lawfully
collects personal data. This is a public-sector system processing citizen/athlete PII
and official records — the controls below are mandatory, not advisory.

> Owner: MoEYS Data Protection Officer (DPO). Engineering implements; the DPO signs
> off retention windows and the minors'-consent text before they are enforced in
> production.

---

## 1. Data classification

Mirrors the ABAC taxonomy in `backend/app/domain/policies/attributes.py::DataClass`.

| Class            | Meaning                                              | Examples |
| ---------------- | ---------------------------------------------------- | -------- |
| `public`         | Publishable without restriction                      | event names, sport list, medal tallies |
| `internal`       | Operational data, staff-only                         | refresh tokens, in-app notifications, survey configs |
| `confidential`   | Sensitive operational / integrity-critical           | audit log, review decisions |
| `restricted_pii` | Direct citizen/athlete identifiers                   | name, phone, national-ID number, DOB, ID-document scans, guardian contact |

`restricted_pii` is the only class with a dedicated access gate: reveals are
`require_admin`, rate-limited, and written to `pii_access_logs` (the value is never
logged) — see `backend/.claude/skills/national-backend-architecture` §7 and CHOS-403.

---

## 2. Retention schedule

Declared once, data-only, in `backend/app/workers/retention/policies.py` (asserted by
`tests/test_retention.py`). Windows are settings so each environment can tune them; the
defaults below are **placeholders pending DPO/legal sign-off**.

| Table             | Class            | Default window | Action         | Notes |
| ----------------- | ---------------- | -------------- | -------------- | ----- |
| `pii_access_logs` | restricted_pii   | 5 years        | `PURGE`        | reveal access trail |
| `refresh_tokens`  | internal         | 7 years        | `PURGE` (spent only) | only `revoked OR expired` rows |
| `notifications`   | internal         | 7 years        | `PURGE` (read only)  | only `read_at IS NOT NULL` |
| `audit_log`       | confidential     | 10 years       | `ARCHIVE_ONLY` | **never auto-deleted** (see below) |

**`enrollments` (the subjects' own PII) is deliberately NOT on a blanket time-based
purge.** Official participation/result records must survive for legitimate aggregate
and statistical use. Removing an individual's personal data is done through the audited
**subject-erasure** workflow (§4), per request, not on a schedule.

**Why `audit_log` is `ARCHIVE_ONLY`:** it is a hash-chained, tamper-evident log
(CHOS-403). Deleting any row breaks `AuditLogWriter.verify_chain`, so its long-term
disposal is a deliberate, signed-off archival export — never an automated `DELETE`.

### Retention purge worker

`backend/app/workers/retention/` — run as `arq app.workers.retention.worker.RetentionWorkerSettings`.

- A daily cron (`RETENTION_PURGE_HOUR`/`MINUTE`, default 03:15) runs the purge.
- **Dry-run by default.** With `RETENTION_ENABLED=0` (default for local/CI) the worker
  reports how many rows *would* be purged but deletes nothing. Flip
  `RETENTION_ENABLED=1` in production only **after** the restore drill (CHOS-502) has
  validated backups.
- **Audited.** Every purge line (dry-run included) is appended to the hash-chained
  audit log (`retention.purge` / `retention.purge.dryrun`) with table, cutoff, and row
  counts — never row contents.

`TODO(ops/legal)`: DPO confirms statutory windows; set the `RETENTION_*_DAYS` env vars
accordingly and enable the purge.

---

## 3. Lawful basis

Processing is on the basis of performing a task in the public interest (organising the
national games) and, for minors, recorded guardian consent (§5). Data minimisation is
enforced in code: list endpoints return a minimised projection; full PII is only served
by the single-record detail endpoint behind an audited reveal.

---

## 4. Subject erasure (right to erasure / DSAR-delete)

`backend/app/workers/retention/erasure.py::SubjectEraser` — invoked by an admin DSAR
action or the `subject_erasure_job` arq job. **Privileged & irreversible**: the caller
must authorise it (`require_admin` / `require_superadmin`).

- **Default = anonymise.** Direct identifiers on the enrollment (names, phone,
  national-ID number, address) are tombstoned to `[erased]`; document-pointer columns
  are nulled; the guardian-consent row is deleted. Participation/result rows survive
  with referential integrity intact, so aggregate statistics are unaffected.
- **`hard=True` = delete.** The enrollment row is deleted; FK cascades remove the
  athlete/leader/participation graph and the consent record. Use only when the entire
  record must go.
- **Audited.** An `subject.erasure.anonymize` / `subject.erasure.delete` entry records
  the actor, target enrollment, mode, reason, and the *names* of cleared fields — never
  their values.

`TODO(storage)`: the document blobs referenced by the nulled path columns are removed by
the object-store lifecycle policy (CHOS-202 storage) — wire the erasure job to also issue
the object delete once the managed bucket + credentials are provisioned.

---

## 5. Minors' PII consent

An under-18's PII may only be collected with a recorded parent/guardian consent.

- **Model:** `backend/src/models/minor_consent.py::MinorConsent` — one row per minor
  enrollment recording the guardian's name, relationship, (encrypted) phone, the policy
  version agreed to, and the timestamp. The enrollment FK cascades on erasure.
- **Enforcement:** `app/application/participants/validation.py::validate_minor_consent`
  rejects a minor registration without consent (`GUARDIAN_CONSENT_REQUIRED`, HTTP 422).
  The age basis matches the document rule (event start date, else today; threshold
  `MINOR_AGE_THRESHOLD`, default 18).
- **Ships dark.** `MINOR_CONSENT_ENFORCED` defaults `False` (mirroring `MFA_ENFORCED`)
  so the enforcement does not break pre-existing clients/tests; the consent record is
  still written whenever consent IS supplied. `TODO(ops)`: flip
  `MINOR_CONSENT_ENFORCED=1` once the registration UI captures guardian consent.
- **Versioning:** `MINOR_CONSENT_POLICY_VERSION` is stamped on each record so a future
  change to the consent text is auditable and can trigger re-consent.

---

## 6. Operational checklist before enabling in production

- [ ] DPO signs off the `RETENTION_*_DAYS` windows and the minors'-consent text.
- [ ] CHOS-502 restore drill green (backups validated) → set `RETENTION_ENABLED=1`.
- [ ] Registration UI captures guardian consent → set `MINOR_CONSENT_ENFORCED=1`.
- [ ] Object-store lifecycle wired to the erasure job for document-blob deletion.
- [ ] Retention worker Deployment has DB_*/REDIS_URL injected (Vault, CHOS-201/205).
