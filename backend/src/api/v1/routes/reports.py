from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.deps import get_db, get_current_user, require_admin, get_effective_org_id
from src.models.user import User
from src.services.report_service import ReportService
from src.services.report_renderers import render_xlsx, render_pdf

router = APIRouter()

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
        ["\u179B.\u179A", "\u1794\u17D2\u179A\u17B6\u1794\u17C1\u1791\u17B6\u1780\u17D2\u179F\u17B6", "\u1794\u17CB\u179F\u17C7\u17A0\u17D2\u1793\u17C7\u1794\u17C1\u1784\u17D2\u1782\u17B6\u1799", "\u1794\u17C1\u179F\u17C7\u017F", "\u1793\u17B6\u179A\u17B8\u017F"],  # noqa: E501
        ["no", "sport_name_kh", "org_count", "male_planned", "female_planned"],
        {3, 4},
    ),
    "totals": (
        ["\u1794\u17D2\u179A\u17B6\u1780\u17C1\u1794\u17C0\u179C\u1794\u17B7\u1793\u17C7\u17A0\u17C1\u1791\u17C5\u1794\u17B7\u1796\u17D2\u1793\u17C7\u17A0\u17BC\u179C"],
        [],
        set(),
    ),
    # \u17E3 \u1785\u17BB\u17C7\u1785\u17C6\u1793\u17BD\u1793 \u2014 counts per sport
    "counts": (
        ["\u179B.\u179A", "\u1794\u17D2\u179A\u1797\u17C1\u1791\u1780\u17B8", "\u1794\u17D2\u179A\u178F\u17B7\u1797\u17BC", "\u178A\u17B9\u1780\u1793\u17B6\u17C6", "\u1782\u17D2\u179A\u17BC\u1794\u1784\u17D2\u179C\u17B9\u1780", "\u17A2\u178F\u17D2\u178F\u1796\u179B\u17B7\u1780", "\u179F\u179A\u17BB\u1794"],
        ["no", "sport_name_kh", "delegates", "leaders", "coaches", "athletes", "total"],
        {2, 3, 4, 5, 6},
    ),
    # \u17E4 \u17A2\u17B6\u179B\u17CB\u1794\u17CA\u17BB\u1798 \u2014 full enroll album per org
    "album": (
        ["\u1782\u17C4\u178F\u17D2\u178F\u1793\u17B6\u1798", "\u1793\u17B6\u1798", "\u1797\u17C1\u1791", "\u179F\u1789\u17D2\u1787\u17B6\u178F\u17B7", "\u1782\u17C4\u178F\u17D2\u178F\u1793\u17B6\u1798\u17A1\u17B6\u178F\u17B6\u17C6\u1784", "\u1793\u17B6\u1798\u17A1\u17B6\u178F\u17B6\u17C6\u1784",
         "\u1790\u17D2\u1784\u17C3\u1781\u17C2\u1786\u17D2\u1793\u17B6\u17C6\u1780\u17C6\u178E\u17BE\u178F", "\u178F\u17BD\u1793\u17B6\u1791\u17B8", "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793", "\u179B\u17C1\u1781\u1791\u17BC\u179A\u179F\u17D0\u1796\u17D2\u1791"],
        ["kh_family_name", "kh_given_name", "gender", "nationality", "en_family_name",
         "en_given_name", "date_of_birth", "role", "address", "phonenumber"],
        set(),
    ),
    # \u17E5 \u179A\u17B6\u1799\u1793\u17B6\u1798\u179A\u17BD\u1798 \u2014 combined name list
    "name-list": (
        ["\u179B.\u179A", "\u1782\u17C4\u178F\u17D2\u178F\u1793\u17B6\u1798", "\u1793\u17B6\u1798", "\u1797\u17C1\u1791", "\u1790\u17D2\u1784\u17C3\u1781\u17C2\u1786\u17D2\u1793\u17B6\u17C6\u1780\u17C6\u178E\u17BE\u178F", "\u179F\u1789\u17D2\u1787\u17B6\u178F\u17B7",
         "\u178F\u17BD\u1793\u17B6\u1791\u17B8", "\u1794\u17D2\u179A\u1797\u17C1\u1791\u1780\u17B8", "\u17A2\u1784\u17D2\u1782\u1797\u17B6\u1796"],
        ["no", "kh_family_name", "kh_given_name", "gender", "date_of_birth",
         "nationality", "role", "category_sport", "org_name_kh"],
        {0},
    ),
    # \u17E6 \u1790\u17D2\u1793\u17B6\u1780\u17CB\u178A\u17B9\u1780\u1793\u17B6\u17C6 \u2014 leaders / special roles
    "leaders": (
        ["\u1782\u17C4\u178F\u17D2\u178F\u1793\u17B6\u1798", "\u1793\u17B6\u1798", "\u1797\u17C1\u1791", "\u1790\u17D2\u1784\u17C3\u1781\u17C2\u1786\u17D2\u1793\u17B6\u17C6\u1780\u17C6\u178E\u17BE\u178F", "\u179F\u1789\u17D2\u1787\u17B6\u178F\u17B7", "\u178F\u17BD\u1793\u17B6\u1791\u17B8", "\u17A2\u1784\u17D2\u1782\u1797\u17B6\u1796"],
        ["kh_family_name", "kh_given_name", "gender", "date_of_birth", "nationality",
         "role", "org_name_kh"],
        set(),
    ),
    # \u17E7 \u1782\u17D2\u179A\u17BC\u1794\u1784\u17D2\u179C\u17B9\u1780 \u17A2\u178F\u17D2\u178F\u1796\u179B\u17B7\u1780 \u2014 coaches + athletes per sport
    "coach-athlete": (
        ["\u1782\u17C4\u178F\u17D2\u178F\u1793\u17B6\u1798", "\u1793\u17B6\u1798", "\u1797\u17C1\u1791", "\u1790\u17D2\u1784\u17C3\u1781\u17C2\u1786\u17D2\u1793\u17B6\u17C6\u1780\u17C6\u178E\u17BE\u178F", "\u1794\u17D2\u179A\u1797\u17C1\u1791\u1780\u17B8", "\u178F\u17BD\u1793\u17B6\u1791\u17B8", "\u17A2\u1784\u17D2\u1782\u1797\u17B6\u1796"],
        ["kh_family_name", "kh_given_name", "gender", "date_of_birth", "sport_name_kh",
         "role_label", "org_name_kh"],
        set(),
    ),
    # \u17E8 \u1794\u17D2\u179A\u178F\u17B7\u1797\u17BC \u17A2\u17D2\u1793\u1780\u178A\u17B9\u1780\u1793\u17B6\u17C6 \u2014 delegation leadership
    "delegation": (
        ["\u1782\u17C4\u178F\u17D2\u178F\u1793\u17B6\u1798", "\u1793\u17B6\u1798", "\u1797\u17C1\u1791", "\u179B\u17C1\u1781\u1791\u17BC\u179A\u179F\u17D0\u1796\u17D2\u1791", "\u178F\u17BD\u1793\u17B6\u1791\u17B8", "\u17A2\u1784\u17D2\u1782\u1797\u17B6\u1796", "\u1794\u17D2\u179A\u1797\u17C1\u1791\u1780\u17B8"],
        ["kh_family_name", "kh_given_name", "gender", "phonenumber", "role_name_kh",
         "org_name_kh", "sport_name_kh"],
        set(),
    ),
}

# For totals, columns are dynamic per event (one column per sport)
# We'll build them at request time.

HEADER_MAP = {
    "sport-list": "\u1785\u17CB\u1794\u17D2\u179A\u17B6\u1794\u17C1\u1791\u17B6\u1780\u17D2\u179F\u17B6",
    "totals": "\u1785\u17D2\u1793\u17C8\u1793\u17D2\u1781\u17BC\u1798",
    "counts": "\u1785\u17CB\u1785\u17D2\u1793\u17C8\u1793",
    "album": "\u17A2\u17B6\u179B\u17CB\u1794\u17BB\u1798",
    "name-list": "\u179A\u17B6\u1799\u1793\u17B6\u1798\u17BC\u1798",
    "leaders": "\u1790\u17D2\u1793\u17B6\u1780\u17CA\u178A\u17D2\u1780\u1793\u17B6\u17C6",
    "coach-athlete": "\u1782\u17D2\u179A\u17BC\u1794\u1780\u17D2\u1793\u17C0\u1780 \u17A2\u178F\u17D2\u178F\u1796\u179B\u17B7\u1780",
    "delegation": "\u1794\u17D2\u179A\u17B6\u178F\u17D2\u1797\u17BC \u17A2\u17D2\u1793\u17B6\u1794\u1780\u17D2\u178F\u17D2\u1793\u17B6\u17C6",
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
    display = ["\u1794\u17D2\u179A\u17B6\u1780\u17C1\u1794\u17C0\u179C"]
    keys = ["org_name_kh"]
    numeric = set()
    for k in rows[0].keys() if rows else []:
        if k.startswith("sport_"):
            parts = k.split("_")
            sport_id = parts[1]
            gender = parts[2]
            # We'll look up sport name later
            keys.append(k)
            numeric.add(len(keys) - 1)
    keys.extend(["total_athletes", "grand_total"])
    display.extend(["..." for _ in keys[1:]])  # placeholder; user will see numeric cols
    return display, keys, numeric


def _make_xlsx(
    key: str, columns: list[tuple[str, int]], col_keys: list[str], rows: list[dict]
) -> bytes:
    """Build XLSX bytes."""
    return render_xlsx(columns, rows, col_keys)


def _make_pdf(
    key: str,
    display_headers: list[str],
    col_keys: list[str],
    rows: list[dict],
    numeric_indices: set[int],
    event_name: str,
) -> bytes:
    title = HEADER_MAP.get(key, key)
    subtitle = event_name
    return render_pdf(title, subtitle, display_headers, rows, col_keys, numeric_indices)


@router.get("/reports/{key}")
async def generate_report(
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

    Supported keys: sport-list, totals, counts, album, name-list, leaders, coach-athlete, delegation.
    """
    if key not in REPORT_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown report key: {key}")

    effective_org_id = get_effective_org_id(current_user, org_id)
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
        content = render_xlsx(xlsx_cols, rows, col_keys)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{key}_{event_id}.xlsx"
    else:
        content = render_pdf(
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
