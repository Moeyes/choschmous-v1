"""Append-only, hash-chained audit-log writer (CHOS-403).

``append()`` is the ONLY supported way to write ``audit_log``: it computes the
next link in the tamper-evident chain and mirrors the event to the SIEM. Chain
appends are serialised with a transaction-scoped Postgres advisory lock so two
concurrent appends cannot both read the same ``prev_hash`` and fork the chain.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit.chain import (
    GENESIS_HASH,
    canonical_payload,
    compute_row_hash,
    verify_rows,
)
from app.application.audit.siem import ship_event
from src.models.audit_log import AuditLog

# Arbitrary fixed key identifying the audit-chain advisory lock (any process
# appending takes the same lock, so appends across requests serialise).
_CHAIN_LOCK_KEY = 0x4155_4449_5400  # "AUDIT\0"


class AuditLogWriter:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def append(
        self,
        *,
        action: str,
        entity_type: str,
        actor_user_id=None,
        actor_role: str | None = None,
        entity_id: str | None = None,
        summary: str | None = None,
    ) -> AuditLog:
        # Serialise chain appends. Advisory lock is released at txn end.
        await self.db.execute(
            text("SELECT pg_advisory_xact_lock(:k)"), {"k": _CHAIN_LOCK_KEY}
        )

        last_hash = (
            await self.db.execute(
                select(AuditLog.row_hash).order_by(AuditLog.id.desc()).limit(1)
            )
        ).scalar_one_or_none()
        prev_hash = last_hash or GENESIS_HASH

        # created_at is set in Python (not server_default) so the exact value is
        # known before flush and folded into the hash deterministically.
        created_at = datetime.now(timezone.utc)
        payload = canonical_payload(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            created_at=created_at,
        )
        row_hash = compute_row_hash(prev_hash, payload)

        row = AuditLog(
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            created_at=created_at,
            prev_hash=prev_hash,
            row_hash=row_hash,
        )
        self.db.add(row)
        await self.db.flush()

        # Mirror to the SIEM (best-effort; never blocks/raises the business txn).
        await ship_event(
            {
                "id": row.id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "actor_user_id": str(actor_user_id) if actor_user_id else None,
                "actor_role": actor_role,
                "summary": summary,
                "created_at": created_at.isoformat(),
                "row_hash": row_hash,
                "prev_hash": prev_hash,
            }
        )
        return row

    async def verify_chain(self) -> tuple[bool, int | None]:
        """Recompute the whole chain. Returns ``(ok, first_bad_id)``."""
        rows = (
            await self.db.execute(select(AuditLog).order_by(AuditLog.id.asc()))
        ).scalars().all()
        return verify_rows(list(rows))
