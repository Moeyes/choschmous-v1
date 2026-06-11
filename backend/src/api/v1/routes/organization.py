from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import create_org_limiter
from src.database.deps import (
    get_db,
    get_current_user,
    enforce_org_access,
    require_admin,
)
from src.models.user import User
from src.services.organization_service import OrganizationService
from src.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationPublic,
    OrganizationsPublic,
)

router = APIRouter()


@router.post(
    "", response_model=OrganizationPublic, status_code=status.HTTP_201_CREATED
)
async def create_organization(
    request: Request,
    response: Response,
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    **Register a new Organization (e.g., Federation, Province, or Club).**

    **Scenario:**
    Admin creates a formal entity that will register athletes.
    Requires Khmer/English names and a logo URL (usually hosted on Cloudinary).

    **Success Response:**
    - `201 Created`: Organization successfully registered.

    **Error Cases:**
    - `400 Bad Request`: Validation failure if naming conventions or required fields are missing.
    """
    await create_org_limiter.check(request, response=response)
    service = OrganizationService(db)
    return await service.create_organization(payload)


@router.get("", response_model=OrganizationsPublic)
async def list_organizations(
    skip: int = 0,
    limit: int = 100,
    name: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve a paginated list of all organizations.

    - **skip**: Number of records to skip for pagination. Default is 0.
    - **limit**: Maximum number of records to return. Default is 100.
    - **name**: Optional filter to search organizations by their Khmer name.
    """
    service = OrganizationService(db)
    filters = {}
    if name:
        filters["name_kh"] = name

    data = await service.get_organizations(skip=skip, limit=limit, filters=filters)
    return {"data": data, "count": len(data)}


@router.get("/{org_id}", response_model=OrganizationPublic)
async def get_organization(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve specific organization details by ID.

    Returns the full profile of the organization if found, otherwise returns a 404 error.

    Access control: ORGANIZATION-role users may only read their own organization;
    admin / super_admin / federation may read any.
    """
    enforce_org_access(current_user, org_id)
    service = OrganizationService(db)
    org = await service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


class OrganizationUpdateBody(BaseModel):
    org_id: int
    data: OrganizationUpdate


@router.patch("/update", response_model=OrganizationPublic)
async def update_organization(
    body: OrganizationUpdateBody = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing organization's profile.

    Allows partial updates of organization fields.
    Requires the `org_id` and the `data` object containing the fields to update.

    Access control: ORGANIZATION-role users may only update their own organization;
    admin / super_admin / federation may update any.
    """
    enforce_org_access(current_user, body.org_id)
    service = OrganizationService(db)
    org = await service.update_organization(body.org_id, body.data)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


class OrganizationDeleteBody(BaseModel):
    org_id: int


@router.delete("/delete", status_code=status.HTTP_200_OK)
async def delete_organization(
    body: OrganizationDeleteBody = Body(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    **Permanently delete an organization.**

    **Scenario:**
    Used when an organization profile was created in error or is no longer active.
    **Warning**: This action is PERMANENT. If an athlete or event is linked to this organization, it may cause orphan records in the system.

    **Success Response:**
    - `204 No Content`: Organization successfully removed.

    **Error Cases:**
    - `404 Not Found`: Organization ID does not exist.
    """
    service = OrganizationService(db)
    success = await service.delete_organization(body.org_id)
    if not success:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"message": "Organization deleted"}
