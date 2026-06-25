"""Bulk athlete import schemas (CHOS-406)."""

from __future__ import annotations

from pydantic import BaseModel


class RowError(BaseModel):
    field: str | None = None
    code: str | None = None
    message: str


class RowResult(BaseModel):
    row: int  # 1-based spreadsheet row number (header = row 1)
    ok: bool
    enroll_id: int | None = None
    errors: list[RowError] = []


class ImportReport(BaseModel):
    """Outcome of a validate (dry-run) or commit import.

    ``committed`` is False for a dry-run validate. ``created`` counts rows that
    were actually inserted (always 0 on a dry-run). ``rows`` is the per-row
    report — the error report the operator fixes and re-uploads.
    """

    committed: bool
    total: int
    valid: int
    invalid: int
    created: int
    rows: list[RowResult]
