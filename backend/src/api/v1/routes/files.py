import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import upload_limiter
from src.database.deps import get_db, get_current_user
from src.models.uploaded_file import UploadedFile
from src.models.user import User
from src.services.file_access import user_can_access_file

logger = logging.getLogger(__name__)

router = APIRouter()

# Athlete photos / ID documents are Restricted-PII. Keep the surface tight:
# images + PDF only, small, and validated by actual file signature (not the
# client-declared MIME type, which is attacker-controlled). Per-field limits
# Per-field limits (photo = image, document = image|pdf) are enforced client-side; this
# is the server-side safety net and caps everything at the largest allowance.
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


class UploadResponse(BaseModel):
    id: uuid.UUID
    url: str


def _sniff_type(data: bytes) -> str | None:
    """Return the canonical MIME type from the file's magic bytes, or None.

    Guards against a client uploading a mismatched/disguised payload with a
    spoofed Content-Type header.
    """
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:5] == b"%PDF-":
        return "application/pdf"
    return None


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Store an uploaded file in the database, keyed by a new UUID.**

    Validates type (JPG/PNG/WebP/PDF) and size (<= 5MB), then persists the raw
    bytes and returns the file's id plus a relative URL (`/api/files/{id}`) the
    client can store and render directly.
    """
    await upload_limiter.check(request, key_suffix=str(current_user.id), response=response)
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Allowed: JPG, PNG, WebP, PDF.",
        )

    # Reject obviously-oversized uploads before reading the body when the client
    # sent a Content-Length we can trust.
    if file.size is not None and file.size > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5MB.",
        )

    data = await file.read()

    if len(data) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file.")
    if len(data) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5MB.",
        )

    sniffed = _sniff_type(data)
    if sniffed is None or sniffed != file.content_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content does not match an allowed type (JPG, PNG, WebP, PDF).",
        )

    record = UploadedFile(
        filename=file.filename,
        content_type=sniffed,
        size=len(data),
        data=data,
        uploaded_by=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return UploadResponse(id=record.id, url=f"/api/files/{record.id}")


@router.get("/{file_id}")
async def get_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Serve a stored file by its id.** Auth-required (contents are PII).

    Object-level authorization: a non-admin caller may only read files they
    uploaded or files referenced by an enrollment within their organization /
    sport scope (see ``user_can_access_file``). Every access is audit-logged.
    """
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    record = result.scalars().first()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    if not await user_can_access_file(db, current_user, record):
        # 404 (not 403) so an unauthorized caller can't even confirm the file exists.
        logger.warning(
            "File access DENIED user=%s role=%s file=%s",
            current_user.id, getattr(current_user.role, "value", current_user.role), file_id,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

    logger.info(
        "File access user=%s role=%s file=%s",
        current_user.id, getattr(current_user.role, "value", current_user.role), file_id,
    )

    safe_filename = (record.filename or str(record.id)).replace('"', "").replace("\r", "").replace("\n", "")
    return Response(
        content=record.data,
        media_type=record.content_type,
        headers={
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": f'inline; filename="{safe_filename}"',
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
        },
    )
