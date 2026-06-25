"""CHOS-501 — retention purge policies + dry-run/real purge + subject erasure."""

from datetime import date, datetime, timezone

from sqlalchemy import func, select

from app.workers.retention import POLICIES, SubjectEraser, run_retention_purge
from app.workers.retention.policies import RetentionAction, build_policies
from src.models.audit_log import AuditLog
from src.models.enroll import Enroll
from src.models.enum.user import IdDocumentType, genderEnum
from src.models.pii_access_log import PiiAccessLog


def test_audit_log_is_archive_only_never_purged():
    """The hash-chained audit_log must never be on a destructive purge — deleting
    a chain row would break tamper-evidence."""
    audit = [p for p in build_policies() if p.table == "audit_log"]
    assert audit, "audit_log retention policy missing"
    assert audit[0].action is RetentionAction.ARCHIVE_ONLY
    assert not audit[0].purgeable


def test_policies_cover_pii_and_have_windows():
    pii = [p for p in POLICIES if p.table == "pii_access_logs"]
    assert pii and pii[0].purgeable and pii[0].retention_days > 0


async def _seed_old_pii_log(db) -> int:
    row = PiiAccessLog(
        actor_role="admin",
        target_enroll_id=None,
        fields="phone",
        created_at=datetime(2010, 1, 1, tzinfo=timezone.utc),  # well past any window
    )
    db.add(row)
    await db.flush()
    return row.id


async def test_dry_run_counts_but_deletes_nothing(db_session):
    log_id = await _seed_old_pii_log(db_session)

    report = await run_retention_purge(db_session, enabled=False)
    assert report.dry_run is True
    assert report.total_matched >= 1
    assert report.total_deleted == 0
    # The row is still there.
    assert await db_session.get(PiiAccessLog, log_id) is not None


async def test_enabled_purge_deletes_expired_rows(db_session):
    log_id = await _seed_old_pii_log(db_session)

    report = await run_retention_purge(db_session, enabled=True)
    assert report.dry_run is False
    assert report.total_deleted >= 1
    assert await db_session.get(PiiAccessLog, log_id) is None
    # The purge itself was audited.
    audited = (
        await db_session.execute(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.action == "retention.purge")
        )
    ).scalar()
    assert audited >= 1


async def _make_enroll(db) -> int:
    enroll = Enroll(
        kh_family_name="សុខ",
        kh_given_name="ដារ៉ា",
        en_family_name="Sok",
        en_given_name="Dara",
        phonenumber="012345678",
        national_id="123456789",
        gender=genderEnum.MALE,
        nationality="Cambodian",
        date_of_birth=date(2000, 1, 1),
        id_document_type=IdDocumentType.CAM_NID,
        address="Phnom Penh",
        photo_path="/uploads/p.jpg",
        national_id_path="/uploads/nid.jpg",
    )
    db.add(enroll)
    await db.flush()
    return enroll.id


async def test_subject_erasure_anonymizes_and_audits(db_session):
    enroll_id = await _make_enroll(db_session)

    result = await SubjectEraser(db_session).erase(
        enroll_id, actor_role="admin", reason="dsar-request"
    )
    assert result["mode"] == "anonymize"

    enroll = await db_session.get(Enroll, enroll_id)
    assert enroll.kh_family_name == "[erased]"
    assert enroll.en_given_name == "[erased]"
    assert enroll.phonenumber == "[erased]"
    assert enroll.national_id == "[erased]"
    assert enroll.photo_path is None
    assert enroll.national_id_path is None

    audited = (
        await db_session.execute(
            select(AuditLog).where(
                AuditLog.action == "subject.erasure.anonymize",
                AuditLog.entity_id == str(enroll_id),
            )
        )
    ).scalar_one()
    # Field NAMES recorded, never the erased values.
    assert "kh_family_name" in (audited.summary or "")
    assert "Sok" not in (audited.summary or "")


async def test_subject_erasure_hard_delete(db_session):
    enroll_id = await _make_enroll(db_session)
    result = await SubjectEraser(db_session).erase(
        enroll_id, actor_role="super_admin", reason="full-delete", hard=True
    )
    assert result["mode"] == "delete"
    assert await db_session.get(Enroll, enroll_id) is None


async def test_subject_erasure_missing_enrollment_raises(db_session):
    from app.workers.retention.erasure import ErasureError

    try:
        await SubjectEraser(db_session).erase(999_999_999, actor_role="admin")
    except ErasureError as exc:
        assert exc.code == 404
    else:  # pragma: no cover
        raise AssertionError("expected ErasureError")
