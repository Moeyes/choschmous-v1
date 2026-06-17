from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import report_limiter
from src.database.deps import (
    get_db,
    get_current_user,
    get_effective_org_id,
)
from src.models.user import User
from src.services.report_service import ReportService
from src.services.report_renderers import render_xlsx, render_pdf

router = APIRouter()

# Cap concurrent CPU-bound renders so report generation cannot starve the async
# workers serving every other request. Renders run in a worker thread (off the
# event loop) and are time-boxed.
_RENDER_CONCURRENCY = 2
_RENDER_TIMEOUT_SECONDS = 30.0
_render_semaphore = asyncio.Semaphore(_RENDER_CONCURRENCY)


async def _render_offloaded(fn, *args):
    """Run a blocking renderer in a thread, bounded by a semaphore + timeout."""
    async with _render_semaphore:
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(fn, *args), timeout=_RENDER_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=503,
                detail="Report generation timed out. Narrow the filters and retry.",
            )


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
            raise HTTPException(status_code=400, detail=f"Unknown report key: {key}")


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


@router.get("/reports/{key}")
async def generate_report(
    request: Request,
    response: Response,
    key: str,
    event_id: int = Query(...),
    org_id: int | None = Query(None),
    source: str | None = Query(None, pattern="^(planned|actual)$"),
    format: str = Query("xlsx", pattern="^(xlsx|pdf)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Generate a report by key.** Org users auto-scope to own org. Admin may
    specify any org_id or omit for event-wide reports.

    Rate-limited per user; rendering is offloaded to a bounded thread pool with a
    timeout so CPU-heavy reports cannot exhaust or block request workers.

    Supported keys: sport-list, totals, counts, album, name-list, leaders, coach-athlete, delegation.
    """
    await report_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )

    if key not in REPORT_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown report key: {key}")

    # Called for its authorization side effect: org-role users are forced to
    # their own org (and rejected if none is linked). Per-row scoping itself
    # happens inside each ReportService method via current_user.
    get_effective_org_id(current_user, org_id)
    service = ReportService(db)

    event = await service._get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    rows = await _fetch_rows(service, key, event_id, current_user, source)

    if key == "totals":
        display_headers, col_keys, numeric_indices = _build_totals_columns(rows)
    else:
        cfg = REPORT_COLUMNS.get(key)
        if not cfg:
            raise HTTPException(status_code=500, detail="Missing column config")
        display_headers, col_keys, numeric_indices = cfg

    xlsx_cols = [(h, 15) for h in display_headers]

    if format == "xlsx":
        content = await _render_offloaded(render_xlsx, xlsx_cols, rows, col_keys)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{key}_{event_id}.xlsx"
    else:
        content = await _render_offloaded(
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

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
