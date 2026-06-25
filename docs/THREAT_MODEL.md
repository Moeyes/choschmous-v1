# Threat Model — MOEYS National Sports-Event Platform (CHOS-505)

> Method: **STRIDE**, per trust boundary and data flow. Scope: the production
> platform handling citizen/athlete PII and official competition records.
> Owner: Security + Platform. Review: each release train, and on any new trust
> boundary. This is a living document — link new findings to `docs/adr/` and the
> per-alert runbooks in `docs/runbooks/`.

## 1. System overview

| Component | Description | Trust boundary |
| --------- | ----------- | -------------- |
| Browser / public client | Citizens, schools, federations, MOEYS staff | Untrusted |
| CDN / WAF (Cloudflare, CHOS-303) | TLS termination, DDoS/bot mitigation, origin lock | Edge |
| BFF (Next.js server) | Renders UI, proxies API calls | DMZ |
| API (FastAPI) | All business logic, authz, PII handling | Internal |
| Workers (arq) | Email, reports, retention purge, subject erasure | Internal |
| PostgreSQL | System of record; field-level encrypted PII (CHOS-403) | Data |
| Redis | Sessions/idempotency/rate-limit/queue broker | Data |
| Vault (CHOS-201) | Dynamic DB creds + static secrets | Secrets |
| Government IdP (OIDC, CHOS-401) | External identity provider | External |
| Observability (Prometheus/Tempo/Loki) | Metrics, traces, logs | Internal |

### Trust boundaries (where data crosses a privilege level)

1. Internet → Edge (CDN/WAF)
2. Edge → BFF/API origin (origin lock, CHOS-303)
3. BFF → API (mesh mTLS, CHOS-505)
4. API/Workers → PostgreSQL / Redis (TLS in transit, dynamic creds)
5. API ↔ Government IdP (OIDC, back-channel)
6. CI/CD → Registry → Cluster (supply chain: cosign sign/verify)

## 2. Key assets

- **Citizen/athlete PII** — names, DOB, phone, ID-document images, guardian data
  for minors. Highest sensitivity (see `docs/DATA_GOVERNANCE.md`).
- **Official records** — registrations, participation, review decisions.
- **Audit trail** — hash-chained append-only log (CHOS-403); tampering must be
  detectable.
- **Credentials & secrets** — password hashes, JWT signing keys, OIDC client
  secret, DB creds.

## 3. STRIDE by component

### 3.1 Authentication (login, MFA, OIDC) — CHOS-401

| STRIDE | Threat | Mitigation | Residual / TODO |
| ------ | ------ | ---------- | --------------- |
| **S**poofing | Credential stuffing with breached passwords | bcrypt hashing; ASVS-grade strength rules; **HIBP breached-password screening (CHOS-505)**; MFA (TOTP/WebAuthn) for privileged roles | Flip `HIBP_ENABLED` / `MFA_ENFORCED` in prod (`TODO(ops)`) |
| **S**poofing | Stolen session / token replay | Short-lived access JWT + rotating refresh `jti`; `token_valid_from` invalidation on password change | — |
| **T**ampering | Forged JWT | Asymmetric secrets, server-side validation; non-local envs reject insecure default keys | — |
| **R**epudiation | "I didn't log in" | Auth events in the hash-chained audit log | — |
| **I**nfo disclosure | OIDC code interception | Authorization-code **+ PKCE**; client secret from Vault | — |
| **D**oS | Login brute force | Rate limiting (CHOS-302) at the edge + app | — |
| **E**oP | Privilege escalation via role tampering | Role read from server-trusted user record, never client claims | — |

### 3.2 Authorization (ABAC engine) — CHOS-402

| STRIDE | Threat | Mitigation |
| ------ | ------ | ---------- |
| **E**oP | IDOR — access another org's data | **Deny-by-default ABAC**; `get_effective_org_id`/`enforce_org_access` force constrained roles to their own org; client-supplied ids silently overridden |
| **E**oP | Cross-sport federation access | `get_effective_sport_id` forces FEDERATION to its own sport |
| **T**ampering | Bypassing the phase gate | Server-side `*_is_open` computed gate (fetch→404→403) on every lifecycle write |
| **R**epudiation | Disputed privileged action | Reveals/decisions audited before returning |

### 3.3 PII handling — CHOS-403 / CHOS-501

| STRIDE | Threat | Mitigation |
| ------ | ------ | ---------- |
| **I**nfo disclosure | PII at rest leak (DB dump/backup) | **Field-level envelope encryption**; ciphertext at rest, plaintext only in-process |
| **I**nfo disclosure | PII in logs / URLs / errors | List projections minimized; reveals via `POST` not `GET`; values never logged (only field names) |
| **R**epudiation | Untracked PII access | `PiiAccessLog` row written **before** any reveal returns |
| **T**ampering | Audit-log alteration | Hash-chained append-only log; `verify_chain` detects the first bad row |
| **I**nfo disclosure | Data kept past lawful basis | Retention purge worker per data class; audited subject erasure (CHOS-501) |
| **E**oP | Minor's data processed without consent | Guardian-consent model enforced in registration (`MINOR_CONSENT_ENFORCED`) |

### 3.4 Edge / network — CHOS-303 / CHOS-505

| STRIDE | Threat | Mitigation |
| ------ | ------ | ---------- |
| **D**oS | Volumetric / L7 flood | Cloudflare DDoS + WAF + rate limits |
| **S**poofing | Bypass the WAF, hit origin directly | Origin lock (only the CDN may reach the origin) |
| **T**ampering / **I** | Sniff/spoof east-west pod traffic | **mTLS STRICT between tiers** + deny-by-default `AuthorizationPolicy` (`infra/mesh/`) |
| **I**nfo disclosure | PII over the wire to DB/Redis | TLS in transit; Vault dynamic DB creds (CHOS-201) |

### 3.5 Supply chain / CI-CD — CHOS-505 / CHOS-503

| STRIDE | Threat | Mitigation |
| ------ | ------ | ---------- |
| **T**ampering | Malicious/poisoned image deployed | **cosign keyless signing** in CI + **admission verification** (`infra/admission/cosign-verify-policy.yaml`) — only images signed by our workflow run |
| **T**ampering | Compromised dependency | `pip-audit`/`npm-audit`/Trivy gates + SBOM (CHOS-101); Dependabot |
| **R**epudiation | "Which build is this?" | Sign by immutable digest; Rekor transparency log |
| **I**nfo disclosure | Secret committed to git | gitleaks secret scanning; secrets only via Vault |

### 3.6 Availability / operations — CHOS-502 / CHOS-504

| STRIDE | Threat | Mitigation |
| ------ | ------ | ---------- |
| **D**oS | AZ / node failure | Multi-AZ topology + chaos experiments (CHOS-502) |
| **D**oS | Bad deploy takes the service down | Canary/blue-green with SLO auto-rollback (CHOS-504) |
| **T**ampering | Backup that can't be restored | Quarterly automated restore drill; validated RPO/RTO (`docs/DR_RUNBOOK.md`) |

## 4. Top risks & status

1. **Breached-credential reuse** → HIBP screening shipped (dark); **action:**
   enable in prod.
2. **PII exfiltration** → encryption + minimized projections + audited reveals;
   **action:** keep field coverage in sync as new PII columns are added.
3. **Supply-chain image tampering** → sign+verify shipped; **action:** install
   policy-controller and fill the workflow-identity regexp.
4. **Insider misuse** → ABAC + audit chain; **action:** periodic audit-chain
   verification job (`docs/runbooks/`).

## 5. Out of scope / external

- **Penetration test** — an independent external pentest is **required before
  go-live** and is tracked as an external engagement (`TODO(security): schedule
  external pentest; see SECURITY.md`). This document is the internal model the
  pentest validates, not a substitute for it.
- Physical security of the hosting provider's data centres.
- The government IdP's own security posture (assessed by its operator).
