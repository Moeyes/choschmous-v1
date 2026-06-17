from typing import Optional
from src.schemas.excel import OrgSportParticipantExcelResponse

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.schemas.excel import OrgSportParticipantFullResponse
from src.services.excel_service import ExcelService
from src.database.deps import get_db, get_current_user, get_effective_org_id
from src.models.user import User

router = APIRouter()


@router.get("/org-sport", response_model=OrgSportParticipantFullResponse)
async def org_sport_participant(
    org_id: Optional[int] = Query(
        None,
        description="Organization ID (ignored for org-role users — derived from token)",
    ),
    events_id: int = Query(..., description="Event ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Export Detailed Participant List for specific Organization.**

    Organization-role users always get their own org's data regardless of org_id param.
    Admin/super_admin can filter by any org_id.
    """
    effective_org_id = get_effective_org_id(current_user, org_id)
    if effective_org_id is None:
        raise HTTPException(status_code=400, detail="org_id is required")
    service = ExcelService(db)
    return await service.get_org_sport_category(effective_org_id, events_id)


@router.get("/org-sport-participant", response_model=OrgSportParticipantExcelResponse)
async def org_sport_participant_counts(
    org_id: Optional[int] = Query(
        None,
        description="Organization ID (ignored for org-role users — derived from token)",
    ),
    events_id: int = Query(..., description="Event ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Summarized Registration Count by Organization.**

    Organization-role users always get their own org's data regardless of org_id param.
    Admin/super_admin can filter by any org_id.
    """
    effective_org_id = get_effective_org_id(current_user, org_id)
    if effective_org_id is None:
        raise HTTPException(status_code=400, detail="org_id is required")
    service = ExcelService(db)
    return await service.get_org_sport_participant_counts(effective_org_id, events_id)
