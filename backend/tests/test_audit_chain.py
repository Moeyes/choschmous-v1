"""Hash-chained audit-log tamper tests (CHOS-403).

Proves the chain is tamper-EVIDENT: an intact chain verifies, and an after-the-
fact edit or deletion (simulating an attacker with direct DB access) is detected
by ``verify_chain`` and pinned to the offending row.
"""

import pytest
from sqlalchemy import text

from app.application.audit import AuditLogWriter
from app.application.audit.chain import GENESIS_HASH


async def _seed(db, n=3):
    writer = AuditLogWriter(db)
    rows = []
    for i in range(n):
        # actor_user_id left None (FK is SET NULL/nullable) — the audit record
        # outlives its actor and these tests don't need a persisted user.
        rows.append(
            await writer.append(
                action="update",
                entity_type="enrollment",
                actor_role="admin",
                entity_id=str(i),
                summary=f"edit {i}",
            )
        )
    return writer, rows


@pytest.mark.asyncio
async def test_chain_links_and_verifies(db_session):
    writer, rows = await _seed(db_session, 3)
    # First row seeds from genesis; each subsequent row links to its predecessor.
    assert rows[0].prev_hash == GENESIS_HASH
    assert rows[1].prev_hash == rows[0].row_hash
    assert rows[2].prev_hash == rows[1].row_hash

    ok, bad = await writer.verify_chain()
    assert ok is True and bad is None


@pytest.mark.asyncio
async def test_content_tamper_is_detected(db_session):
    writer, rows = await _seed(db_session, 3)
    target = rows[1]

    # Attacker edits a row's content directly in the DB (the append-only trigger
    # is the prod defence; here we simulate a bypass to prove detection).
    await db_session.execute(
        text("UPDATE audit_log SET summary = :s WHERE id = :id"),
        {"s": "tampered!", "id": target.id},
    )
    db_session.expire_all()  # force the verifier to re-read from the DB

    ok, bad = await writer.verify_chain()
    assert ok is False
    assert bad == target.id


@pytest.mark.asyncio
async def test_deleting_a_row_breaks_the_chain(db_session):
    writer, rows = await _seed(db_session, 3)

    await db_session.execute(
        text("DELETE FROM audit_log WHERE id = :id"), {"id": rows[1].id}
    )
    db_session.expire_all()

    ok, bad = await writer.verify_chain()
    # Row 2's prev_hash no longer matches the recomputed predecessor (row 0).
    assert ok is False
    assert bad == rows[2].id
