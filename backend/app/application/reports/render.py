"""Report render orchestration (CHOS-202).

This module owns the "fetch rows -> choose columns -> render bytes" pipeline that
previously lived inline in ``src/api/v1/routes/reports.py``. It is now invoked by
the arq worker (``app/workers/report_worker.py``) so rendering happens OFF the
request path. The render logic is unchanged: the column specs (``REPORT_COLUMNS``
/ ``HEADER_MAP``), the ``ReportService`` queries (``_fetch_rows``), and the
``render_xlsx`` / ``render_pdf`` calls are identical to the previous in-route
code — only the call site moved. ``REPORT_KEYS`` is re-exported so the thin route
can still validate the key before enqueuing.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.enum.user import UserRole
from src.models.user import User
from src.services.report_service import ReportService
from src.services.report_renderers import render_xlsx, render_pdf


class ReportRenderError(Exception):
    """Raised when a report cannot be produced. ``code`` is the HTTP status the
    caller should surface — the worker records it; the job-status endpoint maps
    it back onto the HTTP response."""

    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.code = code


@dataclass
class ReportArtifact:
    """The rendered document the worker hands to storage."""

    content: bytes
    media_type: str
    filename: str


REPORT_KEYS = {
    "sport-list",
    "totals",
    "counts",
    "album",
    "name-list",
    "leaders",
    "coach-athlete",
    "delegation",
}

# Column defs: (header, width_chars) for XLSX; display_header for PDF
# Shared across both renderers via col_keys + numeric_indices config.

REPORT_COLUMNS: dict[str, tuple[list[str], list[str], set[int]]] = {
    "sport-list": (
        [
            "\u179b.\u179a",
            "\u1794\u17d2\u179a\u17b6\u1794\u17c1\u1791\u17b6\u1780\u17d2\u179f\u17b6",
            "\u1794\u17cb\u179f\u17c7\u17a0\u17d2\u1793\u17c7\u1794\u17c1\u1784\u17d2\u1782\u17b6\u1799",
            "\u1794\u17c1\u179f\u17c7\u017f",
            "\u1793\u17b6\u179a\u17b8\u017f",
        ],  # noqa: E501
        ["no", "sport_name_kh", "org_count", "male_planned", "female_planned"],
        {3, 4},
    ),
    "totals": (
        [
            "\u1794\u17d2\u179a\u17b6\u1780\u17c1\u1794\u17c0\u179c\u1794\u17b7\u1793\u17c7\u17a0\u17c1\u1791\u17c5\u1794\u17b7\u1796\u17d2\u1793\u17c7\u17a0\u17bc\u179c"
        ],
        [],
        set(),
    ),
    # \u17E3 \u1785\u17BB\u17C7\u1785\u17C6\u1793\u17BD\u1793 \u2014 counts per sport
    "counts": (
        [
            "\u179b.\u179a",
            "\u1794\u17d2\u179a\u1797\u17c1\u1791\u1780\u17b8",
            "\u1794\u17d2\u179a\u178f\u17b7\u1797\u17bc",
            "\u178a\u17b9\u1780\u1793\u17b6\u17c6",
            "\u1782\u17d2\u179a\u17bc\u1794\u1784\u17d2\u179c\u17b9\u1780",
            "\u17a2\u178f\u17d2\u178f\u1796\u179b\u17b7\u1780",
            "\u179f\u179a\u17bb\u1794",
        ],
        ["no", "sport_name_kh", "delegates", "leaders", "coaches", "athletes", "total"],
        {2, 3, 4, 5, 6},
    ),
    # \u17E4 \u17A2\u17B6\u179B\u17CB\u1794\u17CA\u17BB\u1798 \u2014 full enroll album per org
    "album": (
        [
            "\u1782\u17c4\u178f\u17d2\u178f\u1793\u17b6\u1798",
            "\u1793\u17b6\u1798",
            "\u1797\u17c1\u1791",
            "\u179f\u1789\u17d2\u1787\u17b6\u178f\u17b7",
            "\u1782\u17c4\u178f\u17d2\u178f\u1793\u17b6\u1798\u17a1\u17b6\u178f\u17b6\u17c6\u1784",
            "\u1793\u17b6\u1798\u17a1\u17b6\u178f\u17b6\u17c6\u1784",
            "\u1790\u17d2\u1784\u17c3\u1781\u17c2\u1786\u17d2\u1793\u17b6\u17c6\u1780\u17c6\u178e\u17be\u178f",
            "\u178f\u17bd\u1793\u17b6\u1791\u17b8",
            "\u17a2\u17b6\u179f\u1799\u178a\u17d2\u178b\u17b6\u1793",
            "\u179b\u17c1\u1781\u1791\u17bc\u179a\u179f\u17d0\u1796\u17d2\u1791",
        ],
        [
            "kh_family_name",
            "kh_given_name",
            "gender",
            "nationality",
            "en_family_name",
            "en_given_name",
            "date_of_birth",
            "role",
            "address",
            "phonenumber",
        ],
        set(),
    ),
    # \u17E5 \u179A\u17B6\u1799\u1793\u17B6\u1798\u179A\u17BD\u1798 \u2014 combined name list
    "name-list": (
        [
            "\u179b.\u179a",
            "\u1782\u17c4\u178f\u17d2\u178f\u1793\u17b6\u1798",
            "\u1793\u17b6\u1798",
            "\u1797\u17c1\u1791",
            "\u1790\u17d2\u1784\u17c3\u1781\u17c2\u1786\u17d2\u1793\u17b6\u17c6\u1780\u17c6\u178e\u17be\u178f",
            "\u179f\u1789\u17d2\u1787\u17b6\u178f\u17b7",
            "\u178f\u17bd\u1793\u17b6\u1791\u17b8",
            "\u1794\u17d2\u179a\u1797\u17c1\u1791\u1780\u17b8",
            "\u17a2\u1784\u17d2\u1782\u1797\u17b6\u1796",
        ],
        [
            "no",
            "kh_family_name",
            "kh_given_name",
            "gender",
            "date_of_birth",
            "nationality",
            "role",
            "category_sport",
            "org_name_kh",
        ],
        {0},
    ),
    # \u17E6 \u1790\u17D2\u1793\u17B6\u1780\u17CB\u178A\u17B9\u1780\u1793\u17B6\u17C6 \u2014 leaders / special roles
    "leaders": (
        [
            "\u1782\u17c4\u178f\u17d2\u178f\u1793\u17b6\u1798",
            "\u1793\u17b6\u1798",
            "\u1797\u17c1\u1791",
            "\u1790\u17d2\u1784\u17c3\u1781\u17c2\u1786\u17d2\u1793\u17b6\u17c6\u1780\u17c6\u178e\u17be\u178f",
            "\u179f\u1789\u17d2\u1787\u17b6\u178f\u17b7",
            "\u178f\u17bd\u1793\u17b6\u1791\u17b8",
            "\u17a2\u1784\u17d2\u1782\u1797\u17b6\u1796",
        ],
        [
            "kh_family_name",
            "kh_given_name",
            "gender",
            "date_of_birth",
            "nationality",
            "role",
            "org_name_kh",
        ],
        set(),
    ),
    # \u17E7 \u1782\u17D2\u179A\u17BC\u1794\u1784\u17D2\u179C\u17B9\u1780 \u17A2\u178F\u17D2\u178F\u1796\u179B\u17B7\u1780 \u2014 coaches + athletes per sport
    "coach-athlete": (
        [
            "\u1782\u17c4\u178f\u17d2\u178f\u1793\u17b6\u1798",
            "\u1793\u17b6\u1798",
            "\u1797\u17c1\u1791",
            "\u1790\u17d2\u1784\u17c3\u1781\u17c2\u1786\u17d2\u1793\u17b6\u17c6\u1780\u17c6\u178e\u17be\u178f",
            "\u1794\u17d2\u179a\u1797\u17c1\u1791\u1780\u17b8",
            "\u178f\u17bd\u1793\u17b6\u1791\u17b8",
            "\u17a2\u1784\u17d2\u1782\u1797\u17b6\u1796",
        ],
        [
            "kh_family_name",
            "kh_given_name",
            "gender",
            "date_of_birth",
            "sport_name_kh",
            "role_label",
            "org_name_kh",
        ],
        set(),
    ),
    # \u17E8 \u1794\u17D2\u179A\u178F\u17B7\u1797\u17BC \u17A2\u17D2\u1793\u1780\u178A\u17B9\u1780\u1793\u17B6\u17C6 \u2014 delegation leadership
    "delegation": (
        [
            "\u1782\u17c4\u178f\u17d2\u178f\u1793\u17b6\u1798",
            "\u1793\u17b6\u1798",
            "\u1797\u17c1\u1791",
            "\u179b\u17c1\u1781\u1791\u17bc\u179a\u179f\u17d0\u1796\u17d2\u1791",
            "\u178f\u17bd\u1793\u17b6\u1791\u17b8",
            "\u17a2\u1784\u17d2\u1782\u1797\u17b6\u1796",
            "\u1794\u17d2\u179a\u1797\u17c1\u1791\u1780\u17b8",
        ],
        [
            "kh_family_name",
            "kh_given_name",
            "gender",
            "phonenumber",
            "role_name_kh",
            "org_name_kh",
            "sport_name_kh",
        ],
        set(),
    ),
}

# For totals, columns are dynamic per event (one column per sport)
# We'll build them at request time.

HEADER_MAP = {
    "sport-list": "\u1785\u17cb\u1794\u17d2\u179a\u17b6\u1794\u17c1\u1791\u17b6\u1780\u17d2\u179f\u17b6",
    "totals": "\u1785\u17d2\u1793\u17c8\u1793\u17d2\u1781\u17bc\u1798",
    "counts": "\u1785\u17cb\u1785\u17d2\u1793\u17c8\u1793",
    "album": "\u17a2\u17b6\u179b\u17cb\u1794\u17bb\u1798",
    "name-list": "\u179a\u17b6\u1799\u1793\u17b6\u1798\u17bc\u1798",
    "leaders": "\u1790\u17d2\u1793\u17b6\u1780\u17ca\u178a\u17d2\u1780\u1793\u17b6\u17c6",
    "coach-athlete": "\u1782\u17d2\u179a\u17bc\u1794\u1780\u17d2\u1793\u17c0\u1780 \u17a2\u178f\u17d2\u178f\u1796\u179b\u17b7\u1780",
    "delegation": "\u1794\u17d2\u179a\u17b6\u178f\u17d2\u1797\u17bc \u17a2\u17d2\u1793\u17b6\u1794\u1780\u17d2\u178f\u17d2\u1793\u17b6\u17c6",
}


async def _fetch_rows(
    service: ReportService, key: str, event_id: int, current_user, source: str | None
) -> list[dict]:
    match key:
        case "sport-list":
            return await service.sport_list(event_id, current_user)
        case "totals":
            return await service.totals(event_id, current_user, source or "planned")
        case "counts":
            return await service.counts(event_id, current_user)
        case "album":
            return await service.album(event_id, current_user)
        case "name-list":
            return await service.name_list(event_id, current_user)
        case "leaders":
            return await service.leaders_report(event_id, current_user)
        case "coach-athlete":
            return await service.coach_athlete(event_id, current_user)
        case "delegation":
            return await service.delegation(event_id, current_user)
        case _:
            raise ReportRenderError(f"Unknown report key: {key}")


def _build_totals_columns(
    rows: list[dict],
) -> tuple[list[str], list[str], set[int]]:
    """Extract sport columns from the first row of totals data."""
    # Dynamic columns are sport_{id}_male, sport_{id}_female
    display = ["\u1794\u17d2\u179a\u17b6\u1780\u17c1\u1794\u17c0\u179c"]
    keys = ["org_name_kh"]
    numeric = set()
    for k in rows[0].keys() if rows else []:
        if k.startswith("sport_"):
            # The column key itself (e.g. "sport_3_male") is the lookup handle;
            # the sport name is resolved downstream from it.
            keys.append(k)
            numeric.add(len(keys) - 1)
    keys.extend(["total_athletes", "grand_total"])
    display.extend(["..." for _ in keys[1:]])  # placeholder; user will see numeric cols
    return display, keys, numeric


def actor_to_payload(current_user: User) -> dict:
    """Serialize only the scoping attributes the worker needs (no PII).

    Report row-scoping reads ``role`` + ``organization_id`` (via
    ``get_effective_org_id``) and ``sport_id`` for federation scoping. ``id`` is
    carried for completeness/audit. Nothing here is restricted PII, so it is safe
    to place on the Redis job payload."""
    role = getattr(current_user.role, "value", str(current_user.role))
    return {
        "id": str(current_user.id) if current_user.id is not None else None,
        "role": role,
        "organization_id": current_user.organization_id,
        "sport_id": getattr(current_user, "sport_id", None),
    }


def actor_from_payload(payload: dict) -> User:
    """Rebuild the minimal acting user from the enqueued job payload. The
    instance is detached — it is never added to a session."""
    raw_id = payload.get("id")
    return User(
        id=uuid.UUID(raw_id) if isinstance(raw_id, str) else raw_id,
        role=UserRole(payload["role"]),
        organization_id=payload.get("organization_id"),
        sport_id=payload.get("sport_id"),
    )


async def render_report_document(
    db: AsyncSession,
    *,
    key: str,
    event_id: int,
    actor: User,
    source: str | None,
    fmt: str,
) -> ReportArtifact:
    """Produce the report bytes. Identical pipeline to the old in-route path,
    just invoked from the worker. Raises ``ReportRenderError`` on a bad key or a
    missing event so the worker can record a typed failure."""
    if key not in REPORT_KEYS:
        raise ReportRenderError(f"Unknown report key: {key}")

    service = ReportService(db)

    event = await service._get_event(event_id)
    if not event:
        raise ReportRenderError("Event not found", code=404)

    rows = await _fetch_rows(service, key, event_id, actor, source)

    if key == "totals":
        display_headers, col_keys, numeric_indices = _build_totals_columns(rows)
    else:
        cfg = REPORT_COLUMNS.get(key)
        if not cfg:
            raise ReportRenderError("Missing column config", code=500)
        display_headers, col_keys, numeric_indices = cfg

    xlsx_cols = [(h, 15) for h in display_headers]

    # The renderers are CPU-bound and synchronous; run them in a thread so a
    # worker handling multiple jobs concurrently doesn't block its event loop.
    if fmt == "xlsx":
        content = await asyncio.to_thread(render_xlsx, xlsx_cols, rows, col_keys)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{key}_{event_id}.xlsx"
    else:
        content = await asyncio.to_thread(
            render_pdf,
            HEADER_MAP.get(key, key),
            event.name_kh or "",
            display_headers,
            rows,
            col_keys,
            numeric_indices,
        )
        media_type = "application/pdf"
        filename = f"{key}_{event_id}.pdf"

    return ReportArtifact(content=content, media_type=media_type, filename=filename)
