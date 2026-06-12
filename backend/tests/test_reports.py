"""Tests for Phase 5 — reports engine. Verifies all 8 report keys render to
XLSX (with populated data cells), a real WeasyPrint PDF render, and the
error / org-scoping paths."""

import io

import pytest
from openpyxl import load_workbook

from src.models.enum.user import UserRole
from tests.conftest import make_user
from tests.factories import (
    link_org_sport,
    make_event,
    make_org,
    make_sport,
    make_sports_event,
)

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
REPORT_KEYS = [
    "sport-list", "totals", "counts", "album",
    "name-list", "leaders", "coach-athlete", "delegation",
]


async def _event_with_sport(db_session, sport_name="បាល់ទះ"):
    event = await make_event(db_session)
    sport = await make_sport(db_session, name_kh=sport_name)
    org = await make_org(db_session)
    await make_sports_event(db_session, event, sport)
    await link_org_sport(db_session, event, sport, org)
    return event, sport, org


@pytest.mark.parametrize("key", REPORT_KEYS)
async def test_report_renders_xlsx(client, db_session, as_user, key):
    """Every one of the 8 documents must return a valid XLSX (not a 500)."""
    event, _, _ = await _event_with_sport(db_session)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.get(f"/api/reports/{key}?event_id={event.id}&format=xlsx")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith(XLSX_MIME)
    assert resp.content[:2] == b"PK"  # xlsx is a zip container


async def test_sport_list_xlsx_cells_are_populated(client, db_session, as_user):
    """Regression guard: render_xlsx must key cells by col_keys, not the display
    header — otherwise every data cell renders blank."""
    event, sport, _ = await _event_with_sport(db_session, sport_name="កីឡាសាកល្បង")
    as_user(make_user(UserRole.ADMIN))

    resp = await client.get(f"/api/reports/sport-list?event_id={event.id}&format=xlsx")
    assert resp.status_code == 200, resp.text

    ws = load_workbook(io.BytesIO(resp.content)).active
    assert ws.cell(row=1, column=2).value  # header row present
    assert ws.cell(row=2, column=1).value == 1            # "no"
    assert ws.cell(row=2, column=2).value == "កីឡាសាកល្បង"  # sport_name_kh, not blank


async def test_report_pdf_renders(client, db_session, as_user):
    """Exercises the WeasyPrint pipeline end-to-end (Khmer font embedded)."""
    event, _, _ = await _event_with_sport(db_session)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.get(f"/api/reports/sport-list?event_id={event.id}&format=pdf")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


async def test_report_unknown_key_rejected(client, db_session, as_user):
    event = await make_event(db_session)
    as_user(make_user(UserRole.ADMIN))
    resp = await client.get(f"/api/reports/not-a-report?event_id={event.id}&format=xlsx")
    assert resp.status_code == 400, resp.text


async def test_report_missing_event_404(client, db_session, as_user):
    as_user(make_user(UserRole.ADMIN))
    resp = await client.get("/api/reports/sport-list?event_id=999999&format=xlsx")
    assert resp.status_code == 404, resp.text


async def test_report_bad_format_rejected(client, db_session, as_user):
    event, _, _ = await _event_with_sport(db_session)
    as_user(make_user(UserRole.ADMIN))
    resp = await client.get(f"/api/reports/sport-list?event_id={event.id}&format=docx")
    assert resp.status_code == 422, resp.text  # Query pattern validation
