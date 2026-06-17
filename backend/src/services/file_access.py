"""Central authorization policy for stored files (athlete photos / ID documents).

Files are Restricted-PII. **Authorization is based on OWNERSHIP, never on
user-supplied references.** A file's owner is its uploader (``uploaded_by``);
scope is derived from that uploader's organization / sport — values the caller
cannot forge. This is the single source of truth used by every file touchpoint:

    upload      -> records uploaded_by = caller            (files.py)
    download    -> user_can_access_file()                  (files.py GET)
    register    -> assert_can_reference_files()            (participant/organizer)
    update      -> assert_can_reference_files()            (participant)

Policy (deny-by-default):

* ADMIN / SUPER_ADMIN -> any file.
* Uploader            -> their own uploads.
* ORGANIZATION user   -> files whose uploader is in the SAME organization.
* FEDERATION user     -> files whose uploader is in the SAME sport.
* Everyone else       -> denied.

Why not "referenced by an enrollment in my org"? Because any user can create an
enrollment referencing an arbitrary file path, so reference-based access is
forgeable (the self-reference IDOR). Ownership via ``uploaded_by`` is not.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.enum.user import UserRole
from src.models.uploaded_file import UploadedFile
from src.models.user import User

logger = logging.getLogger(__name__)

# Matches a managed file reference: "/api/files/{uuid}". Free-form values
# (external https URLs, legacy /uploads paths, None) are not managed refs and
# are left untouched — they are never served by the authenticated files route.
_FILE_REF_RE = re.compile(
    r"/api/files/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
)


def extract_file_id(path: Optional[str]) -> Optional[uuid.UUID]:
    """Return the file UUID from a managed '/api/files/{uuid}' ref, else None."""
    if not path or not isinstance(path, str):
        return None
    m = _FILE_REF_RE.search(path)
    if not m:
        return None
    try:
        return uuid.UUID(m.group(1))
    except ValueError:
        return None


async def user_can_access_file(
    db: AsyncSession, user: User, record: UploadedFile
) -> bool:
    """Authoritative read-access check for a stored file. Ownership-based."""
    # Admins see everything.
    if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return True

    # Uploader can always read back what they uploaded.
    if record.uploaded_by is not None and record.uploaded_by == user.id:
        return True

    # No known uploader → no derivable scope → only admin/uploader (handled above).
    if record.uploaded_by is None:
        return False

    # Scope is derived from the UPLOADER's org/sport — not from any reference the
    # caller may have created.
    uploader = await db.get(User, record.uploaded_by)
    if uploader is None:
        return False

    if user.role == UserRole.ORGANIZATION:
        return (
            user.organization_id is not None
            and uploader.organization_id == user.organization_id
        )

    if user.role == UserRole.FEDERATION:
        return user.sport_id is not None and uploader.sport_id == user.sport_id

    return False


async def assert_can_reference_files(
    db: AsyncSession, user: User, paths: Iterable[Optional[str]]
) -> None:
    """Reject an attempt to store a managed file reference the caller can't access.

    Defense-in-depth at write time so a stolen/forged ``/api/files/{uuid}`` can
    never be attached to a record. Uses the SAME ``user_can_access_file`` policy
    as download, so the two can never drift. Non-managed paths (external URLs,
    legacy paths, None) are not validated — they are not served by the files API.
    """
    seen: set[uuid.UUID] = set()
    for path in paths:
        file_id = extract_file_id(path)
        if file_id is None or file_id in seen:
            continue
        seen.add(file_id)

        record = await db.get(UploadedFile, file_id)
        if record is None:
            # Forged / non-existent managed reference.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Referenced file does not exist.",
            )
        if not await user_can_access_file(db, user, record):
            logger.warning(
                "Blocked file reference: user=%s role=%s tried to reference file=%s",
                user.id,
                getattr(user.role, "value", user.role),
                file_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You may only reference files you uploaded or that belong "
                "to your organization/sport.",
            )
