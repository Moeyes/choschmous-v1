# Security Policy

The MOEYS National Sports-Event Platform processes citizen and athlete personal
data and official government records. We take security seriously and welcome
coordinated disclosure from the community and researchers.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately through one of:

- **Email:** `security@moeys.gov.kh` <!-- TODO(security): confirm/replace with the
  real monitored security mailbox before publishing this repo. -->
- **GitHub Security Advisories:** use *“Report a vulnerability”* on the
  repository’s **Security** tab (private advisory).

Encrypt sensitive reports with our PGP key:
`TODO(security): publish the PGP key fingerprint / link to the key here.`

Please include:

- A description of the issue and its impact.
- Steps to reproduce (PoC), affected endpoints/components, and version/commit.
- Any logs or screenshots — **redact real citizen PII**; use test data.

## Our commitment (response targets)

| Stage | Target |
| ----- | ------ |
| Acknowledge receipt | within **2 business days** |
| Triage + severity (CVSS) | within **5 business days** |
| Remediation — Critical / High | **30 days** |
| Remediation — Medium / Low | **90 days** |
| Disclosure | coordinated, after a fix ships (see below) |

We will keep you updated on progress and credit you (if you wish) once the issue
is resolved.

## Coordinated disclosure

- We follow **coordinated disclosure**: please give us a reasonable window
  (default **90 days**, sooner for actively-exploited issues) to remediate
  before any public disclosure.
- For a confirmed, fixed vulnerability we will publish a GitHub Security Advisory
  and, where relevant, request a CVE.
- We will coordinate timing with you and, for issues affecting citizens, with the
  relevant MOEYS communications channel.

## Safe harbor

We will not pursue or support legal action against researchers who:

- Make a good-faith effort to comply with this policy,
- Avoid privacy violations, data destruction, and service degradation,
- Only interact with accounts they own or have explicit permission to test,
- Do **not** access, modify, or retain other people’s personal data, and report
  immediately if they encounter it.

## Scope

**In scope:** this repository’s code and the deployed MOEYS platform
(API, web app, supporting services).

**Out of scope:**

- Denial-of-service / volumetric attacks (already mitigated at the edge,
  CHOS-303 — please do not test these against production).
- Social engineering of MOEYS staff, physical attacks.
- Findings that require a compromised device or a privileged insider.
- The government IdP and other third-party services (report to their operators).

## Related security documentation

- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — STRIDE threat model.
- [`docs/DATA_GOVERNANCE.md`](docs/DATA_GOVERNANCE.md) — data classification,
  retention, erasure, minors’ consent.
- [`docs/ERROR_BUDGET_POLICY.md`](docs/ERROR_BUDGET_POLICY.md) — reliability policy.

> **External penetration test:** an independent external pentest is required
> before go-live and is tracked as a separate engagement
> (`TODO(security): schedule + record results`). This policy governs ongoing
> disclosure; it does not replace that assessment.
