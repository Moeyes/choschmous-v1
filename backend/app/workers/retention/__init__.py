"""Data-retention purge worker + audited subject-erasure (CHOS-501).

Two distinct data-governance jobs live here:

* :mod:`app.workers.retention.purge` — the scheduled, per-data-class **time-based
  purge** of operational/log tables once their retention window elapses. Runs in
  dry-run unless ``RETENTION_ENABLED`` is set; every purge is written to the
  hash-chained audit log.
* :mod:`app.workers.retention.erasure` — the on-demand **subject-erasure**
  (data-subject-access-request / right-to-erasure) workflow: anonymises a single
  person's PII across the enrollment graph, audited, in one transaction.

Policies are declared data-only in :mod:`app.workers.retention.policies` so the
retention schedule is reviewable in one place (and asserted by tests).
"""

from app.workers.retention.policies import POLICIES, RetentionPolicy
from app.workers.retention.purge import PurgeReport, run_retention_purge
from app.workers.retention.erasure import SubjectEraser

__all__ = [
    "POLICIES",
    "RetentionPolicy",
    "PurgeReport",
    "run_retention_purge",
    "SubjectEraser",
]
