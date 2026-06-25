"""Audited subject-erasure workflow (CHOS-501).

Implements the data-subject right-to-erasure / DSAR-deletion for a single
enrollment. Default mode **anonymises** (tombstones the PII columns) rather than
hard-deleting, so the participation/result records that legitimately must survive
for aggregate statistics keep their referential integrity while the personal data
is irreversibly removed. ``hard=True`` instead deletes the enrollment row (FK
cascades remove the athlete/leader/participation graph) for cases where the whole
record must go.

Every erasure is written to the hash-chained audit log: actor, target enrollment,
mode, and the NAMES of the fields cleared — never their values.

Trigger: an admin DSAR action or the ``subject_erasure_job`` arq job
(:mod:`app.workers.retention.worker`). This is a privileged, irreversible
operation — the caller is responsible for authorising it (``require_admin`` /
``require_superadmin``) before invoking.
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit.writer import AuditLogWriter
from src.models.enroll import Enroll
from src.models.minor_consent import MinorConsent

logger = logging.getLogger(__name__)

# Tombstone written into string PII columns. Document-path columns are nulled.
_TOMBSTONE = "[erased]"

# Direct-identifier string columns overwritten with the tombstone.
_PII_TEXT_COLUMNS = (
    "kh_family_name",
    "kh_given_name",
    "en_family_name",
    "en_given_name",
    "phonenumber",
    "national_id",
    "address",
)

# File-pointer columns nulled (the blobs themselves are removed out-of-band by
# the storage lifecycle — see docs/DATA_GOVERNANCE.md).
_PII_FILE_COLUMNS = (
    "photo_path",
    "documents_path",
    "nationality_document_path",
    "birth_certificate_path",
    "national_id_path",
    "passport_path",
)


class ErasureError(Exception):
    """Raised on a bad erasure request. ``code`` is the HTTP status."""

    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.code = code


class SubjectEraser:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def erase(
        self,
        enroll_id: int,
        *,
        actor_user_id=None,
        actor_role: str | None = None,
        reason: str | None = None,
        hard: bool = False,
    ) -> dict:
        """Erase (anonymise, or hard-delete) one subject's PII, audited.

        Returns a summary dict. Caller owns the surrounding transaction/commit.
        Raises :class:`ErasureError` (404) if the enrollment does not exist.
        """
        enroll = await self.db.get(Enroll, enroll_id)
        if enroll is None:
            raise ErasureError("Enrollment not found.", code=404)

        writer = AuditLogWriter(self.db)

        if hard:
            # Remove guardian-consent + the enrollment (FK cascades the graph).
            await self.db.execute(
                delete(MinorConsent).where(MinorConsent.enroll_id == enroll_id)
            )
            await self.db.delete(enroll)
            await self.db.flush()
            await writer.append(
                action="subject.erasure.delete",
                entity_type="enrollments",
                entity_id=str(enroll_id),
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                summary=f"hard-deleted enrollment; reason={reason or 'unspecified'}",
            )
            logger.info("subject erasure (hard) enroll_id=%s", enroll_id)
            return {"enroll_id": enroll_id, "mode": "delete"}

        # Anonymise: tombstone direct identifiers, null file pointers, drop the
        # guardian-consent record (it carries the guardian's PII).
        cleared: list[str] = []
        for col in _PII_TEXT_COLUMNS:
            if getattr(enroll, col, None) is not None:
                setattr(enroll, col, _TOMBSTONE)
                cleared.append(col)
        for col in _PII_FILE_COLUMNS:
            if getattr(enroll, col, None) is not None:
                setattr(enroll, col, None)
                cleared.append(col)

        consent_ids = (
            (
                await self.db.execute(
                    select(MinorConsent.id).where(MinorConsent.enroll_id == enroll_id)
                )
            )
            .scalars()
            .all()
        )
        if consent_ids:
            await self.db.execute(
                delete(MinorConsent).where(MinorConsent.enroll_id == enroll_id)
            )
            cleared.append("minor_consent")

        await self.db.flush()
        await writer.append(
            action="subject.erasure.anonymize",
            entity_type="enrollments",
            entity_id=str(enroll_id),
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            # Field NAMES only; the cleared values are never written to the log.
            summary=(
                f"anonymised fields=[{','.join(cleared)}]; "
                f"reason={reason or 'unspecified'}"
            ),
        )
        logger.info(
            "subject erasure (anonymize) enroll_id=%s fields=%s", enroll_id, cleared
        )
        return {"enroll_id": enroll_id, "mode": "anonymize", "fields": cleared}
