from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.deps import get_db, get_current_user, require_staff, get_effective_org_id
from src.models.user import User
from src.schemas.organizer import (
    OrganizerRegistrationRequest,
    OrganizerResponse,
    OrganizerRoleCreate,
    OrganizerRoleUpdate,
    OrganizerRoleRead,
)
from src.services.organizer_service import OrganizerService

router = APIRouter()


async def get_organizer_service(db: AsyncSession = Depends(get_db)) -> OrganizerService:
    return OrganizerService(db)


@router.post("/registration/organizer", response_model=OrganizerResponse, status_code=status.HTTP_201_CREATED)
async def register_organizer(
    payload: OrganizerRegistrationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register an organizer for an event. Event-level only (no sport/category)."""
    resolved_org_id = get_effective_org_id(current_user, payload.organizationId)
    if resolved_org_id is not None:
        payload.organizationId = resolved_org_id
    service = OrganizerService(db)
    result = await service.register_organizer(payload)
    return result


@router.get("/organizer-roles", response_model=list[OrganizerRoleRead])
async def list_organizer_roles(
    all: bool = Query(False, description="Include inactive roles"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List available organizer roles. By default returns only active ones."""
    service = OrganizerService(db)
    roles = await service.list_roles(active_only=not all)
    return roles


@router.post("/organizer-roles", response_model=OrganizerRoleRead, status_code=status.HTTP_201_CREATED)
async def create_organizer_role(
    payload: OrganizerRoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_staff),
):
    """Create a new organizer role (staff only)."""
    service = OrganizerService(db)
    role = await service.create_role(payload)
    return role


@router.patch("/organizer-roles/{role_id}", response_model=OrganizerRoleRead)
async def update_organizer_role(
    role_id: int,
    payload: OrganizerRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_staff),
):
    """Update an organizer role (staff only)."""
    service = OrganizerService(db)
    role = await service.update_role(role_id, payload)
    return role
