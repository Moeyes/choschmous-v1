"""Bulk athlete import routes (CHOS-406).

Upload an .xlsx of athletes for one event/org/sport/category context. Every row
is run through the same validation as a single registration; the response is a
per-row error report. ``/validate`` is a dry-run (no writes); POST ``/athletes``
commits the valid rows.

Org-role users are forced to their own organization (same rule as single
registration). Mounted under /imports with the standard auth dependency.
"""

from __future__ import annotations

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import participant_write_limiter
from src.database.deps import get_current_user, get_db, get_effective_org_id
from src.models.user import User
from src.schemas.import_athlete import ImportReport
from src.services.import_service import (
    BulkAthleteImporter,
    ImportContext,
    build_template_workbook,
)

router = APIRouter()

# 5 MB — a spreadsheet of athletes is small; this guards against accidental huge
# uploads before we read the whole body into memory.
MAX_IMPORT_SIZE = 5 * 1024 * 1024
_XLSX_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",  # some browsers send this for .xlsx
    "application/zip",  # .xlsx is a zip container
    None,
}


@router.get("/athletes/template")
async def download_template(
    current_user: User = Depends(get_current_user),
) -> Response:
    """Download the .xlsx import template (header row only)."""
    content = build_template_workbook()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="athlete-import-template.xlsx"'
        },
    )


async def _read_upload(file: UploadFile) -> bytes:
    if file.content_type not in _XLSX_TYPES and not (
        file.filename or ""
    ).lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Please upload an .xlsx file (use the provided template).",
        )
    if file.size is not None and file.size > MAX_IMPORT_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5MB.",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    return data


def _context(
    current_user: User, *, event_id, organization_id, sport_id, category_id, force
):
    effective_org = get_effective_org_id(current_user, organization_id)
    if effective_org is None:
        raise HTTPException(status_code=400, detail="organizationId is required")
    return ImportContext(
        event_id=event_id,
        organization_id=effective_org,
        sport_id=sport_id,
        category_id=category_id,
        force=force,
    )


@router.post("/athletes/validate", response_model=ImportReport)
async def validate_import(
    file: UploadFile = File(...),
    eventId: int = Form(...),
    organizationId: int | None = Form(None),
    sportId: int = Form(...),
    categoryId: int | None = Form(None),
    force: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportReport:
    """Dry-run: validate every row, write nothing. Returns the error report."""
    data = await _read_upload(file)
    ctx = _context(
        current_user,
        event_id=eventId,
        organization_id=organizationId,
        sport_id=sportId,
        category_id=categoryId,
        force=force,
    )
    return await BulkAthleteImporter(db, current_user).run(data, ctx, commit=False)


@router.post("/athletes", response_model=ImportReport)
async def commit_import(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    eventId: int = Form(...),
    organizationId: int | None = Form(None),
    sportId: int = Form(...),
    categoryId: int | None = Form(None),
    force: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportReport:
    """Import the valid rows. Each valid row is committed individually so a bad
    row never rolls back the good ones; failed rows come back in the report."""
    await participant_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    data = await _read_upload(file)
    ctx = _context(
        current_user,
        event_id=eventId,
        organization_id=organizationId,
        sport_id=sportId,
        category_id=categoryId,
        force=force,
    )
    return await BulkAthleteImporter(db, current_user).run(data, ctx, commit=True)
