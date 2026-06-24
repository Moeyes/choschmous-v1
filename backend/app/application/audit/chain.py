"""Audit-log hash-chain primitives (CHOS-403).

The chain makes the audit log tamper-EVIDENT: every row stores
``row_hash = sha256(prev_hash || canonical(content))`` where ``prev_hash`` is the
preceding row's ``row_hash``. Recomputing the chain top-to-bottom detects any
content edit (row_hash no longer matches), deletion / reorder / insertion (a
later row's ``prev_hash`` no longer matches the recomputed predecessor), because
each row cryptographically commits to its predecessor.

``created_at`` is folded in as integer microseconds-since-epoch rather than an
ISO string, so the verifier is immune to timezone/format round-trip differences
between what was written and what the DB hands back.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any

# Seed of the chain — the (virtual) hash "before" the first row.
GENESIS_HASH = "0" * 64


def _dt_key(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return int(round(value.timestamp() * 1_000_000))
    return value


def canonical_payload(
    *,
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    summary,
    created_at,
) -> str:
    """Deterministic JSON of a row's auditable content (NEVER includes the PII
    values themselves — only metadata about what happened)."""
    return json.dumps(
        {
            "actor_user_id": str(actor_user_id) if actor_user_id is not None else None,
            "actor_role": actor_role,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "summary": summary,
            "created_at": _dt_key(created_at),
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )


def compute_row_hash(prev_hash: str, payload: str) -> str:
    return hashlib.sha256((prev_hash + payload).encode("utf-8")).hexdigest()


def verify_rows(rows: list) -> tuple[bool, int | None]:
    """Recompute the chain over ``rows`` (must be ordered by id ascending).

    Returns ``(ok, first_bad_id)``: ``(True, None)`` if intact, else ``(False,
    id)`` of the first row whose stored hash/linkage does not match.
    """
    prev = GENESIS_HASH
    for r in rows:
        payload = canonical_payload(
            actor_user_id=r.actor_user_id,
            actor_role=r.actor_role,
            action=r.action,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            summary=r.summary,
            created_at=r.created_at,
        )
        expected = compute_row_hash(prev, payload)
        if r.prev_hash != prev or r.row_hash != expected:
            return False, r.id
        prev = r.row_hash
    return True, None
