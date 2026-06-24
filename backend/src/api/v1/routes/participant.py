from typing import Optional

from fastapi import (
    APIRouter,
    Body,
    Depends,
    Query,
    Response,
    status,
    HTTPException,
)
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request as FastAPIRequest

from core.idempotency import check_idempotency, store_idempotency_result
from core.ratelimit import participant_write_limiter, reveal_limiter
from src.database.deps import (
    get_db,
    get_current_user,
    get_effective_org_id,
    enforce_org_access,
    require_admin,
)
from src.models.user import User
from src.models.pii_access_log import PiiAccessLog
from src.models.enum.user import LeaderRole
from src.schemas.enroll import (
    ParticipantFilterParams,
    ParticipantUpdateBody,
    ParticipantDeleteBody,
    RoleEnum,
    FullRegistrationRequest,
)
from app.application.participants import (
    RegisterParticipant,
    ParticipantQuery,
    RevealParticipantPii,
    UpdateParticipant,
)

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_participant(
    request: FastAPIRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    payload: FullRegistrationRequest = Body(
        ...,
        openapi_examples={
            "Athlete Example": {
                "summary": "Registering a new Athlete",
                "description": "Athlete requires a categoryId.",
                "value": {
                    "eventId": 11,
                    "organizationId": 5,
                    "sportId": 1,
                    "categoryId": 22,
                    "lastNameKhmer": "សុខ",
                    "firstNameKhmer": "សប្បាយ",
                    "lastNameLatin": "Sok",
                    "firstNameLatin": "Sabbay",
                    "gender": "Male",
                    "dateOfBirth": "2005-05-20",
                    "phone": "012345678",
                    "idDocType": "IDCard",
                    "photoUrl": "https://example.com/photo.jpg",
                    "nationalityDocumentUrl": "https://example.com/nationality.pdf",
                    "birthCertificateUrl": "https://example.com/birth.pdf",
                    "nationalIdUrl": "https://example.com/id.pdf",
                    "passportUrl": "https://example.com/passport.pdf",
                    "role": "Athlete",
                },
            },
            "Leader Example": {
                "summary": "Registering a Coach/Manager",
                "description": "Leaders require a leaderRole and categoryId is null.",
                "value": {
                    "eventId": 11,
                    "organizationId": 5,
                    "sportId": 1,
                    "categoryId": None,
                    "lastNameKhmer": "ចាន់",
                    "firstNameKhmer": "តារា",
                    "lastNameLatin": "Chan",
                    "firstNameLatin": "Dara",
                    "gender": "Male",
                    "dateOfBirth": "1985-10-15",
                    "phone": "099888777",
                    "idDocType": "Passport",
                    "photoUrl": "https://example.com/photo.jpg",
                    "nationalityDocumentUrl": "https://example.com/nationality.pdf",
                    "birthCertificateUrl": "https://example.com/birth.pdf",
                    "nationalIdUrl": "https://example.com/id.pdf",
                    "passportUrl": "https://example.com/passport.pdf",
                    "role": "leader",
                    "leaderRole": "coach",
                },
            },
        },
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    **Register a new participant (Athlete or Leader/Staff).**

    **Requirements:**
    - Athletes MUST have a `categoryId`.
    - Leaders (coach, manager, etc.) MUST have a `leaderRole`.

    **Access control:** ORGANIZATION users are forced to their own org;
    admin/super_admin/federation may register any org.
    """
    await participant_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    # Force organizationId from token for org-role users
    effective_org_id = get_effective_org_id(current_user, payload.organizationId)
    if effective_org_id is None:
        raise HTTPException(status_code=400, detail="organizationId is required")
    payload.organizationId = effective_org_id

    idempotency_key = await check_idempotency(request)
    if idempotency_key is not None and not isinstance(idempotency_key, str):
        return idempotency_key

    result = await RegisterParticipant(db).execute(payload, current_user)

    if isinstance(idempotency_key, str):
        await store_idempotency_result(idempotency_key, 201, result)

    return result


@router.get("")
async def list_participants(
    role: Optional[RoleEnum] = Query(
        None,
        description="Filter by participant role; omit to return athletes + leaders",
    ),
    event_id: Optional[int] = Query(None, description="Filter by event ID"),
    sport_id: Optional[int] = Query(None, description="Filter by sport ID"),
    organization_id: Optional[int] = Query(
        None,
        description="Filter by organization ID (ignored for org-role users — derived from token)",
    ),
    category_id: Optional[int] = Query(
        None, description="Filter by category ID (athlete only)"
    ),
    gender: Optional[str] = Query(
        None, description="Filter by gender (MALE/FEMALE/OTHER)"
    ),
    leader_roles: Optional[list[LeaderRole]] = Query(
        None, description="Filter by one or more leader roles (coach, manager, etc.)"
    ),
    detailed: bool = Query(
        False,
        description=(
            "Return the richer per-row projection (category/gender/organization/"
            "event) used by the sport-detail participant panel. The default list "
            "stays lean for data minimization."
        ),
    ),
    limit: int = Query(20, ge=1, le=200, description="Page size"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List participants with advanced filtering and search.

    - **role**: Required filter for participant type (Athlete, Leader, etc.).
    - **event_id**, **sport_id**, **organization_id**: Standard relational filters.
    - **leader_roles**: List of specific leader roles to include.

    Free-text search (names / phone numbers) is intentionally NOT accepted here:
    Restricted-PII must never ride in a URL/query string (data-governance §3). Use
    ``POST /search`` instead, which takes the search term in the request body.

    Organization-role users are always scoped to their own organization regardless
    of any organization_id query parameter supplied.
    """
    effective_org_id = get_effective_org_id(current_user, organization_id)
    params = ParticipantFilterParams(
        role=role,
        event_id=event_id,
        sport_id=sport_id,
        organization_id=effective_org_id,
        category_id=category_id,
        gender=gender,
        leader_roles=leader_roles,
        limit=limit,
        offset=offset,
    )
    return await ParticipantQuery(db).list(params, detailed=detailed)


@router.post("/search")
async def search_participants(
    body: ParticipantFilterParams = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search/list participants with all filters supplied in the request **body**.

    Behaviourally identical to ``GET /`` but keeps Restricted-PII (names, phone
    numbers) out of the URL, browser history, referrers and access logs
    (data-governance §3). Prefer this endpoint over the GET for any search that
    may contain personal data.

    Organization-role users are always scoped to their own organization,
    regardless of any ``organization_id`` supplied in the body.
    """
    effective_org_id = get_effective_org_id(current_user, body.organization_id)
    params = ParticipantFilterParams(
        role=body.role,
        event_id=body.event_id,
        sport_id=body.sport_id,
        organization_id=effective_org_id,
        category_id=body.category_id,
        gender=body.gender,
        leader_roles=body.leader_roles,
        search=body.search,
        limit=body.limit,
        offset=body.offset,
    )
    return await ParticipantQuery(db).list(params)


@router.post("/{enroll_id}/reveal")
async def reveal_participant_pii(
    enroll_id: int,
    request: FastAPIRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Reveal a participant's masked phone number. **Admin / super-admin only.**

    Rate-limited per admin (a burst of reveals signals bulk exfiltration). Every
    successful reveal is recorded in ``pii_access_logs`` (actor, role, target,
    field, timestamp) *before* the value is returned — the value itself is never
    written to the audit log (data-governance §4/§6). Masked by default in the
    UI; this is the explicit, permission-gated, audited action that exposes the
    real value.
    """
    await reveal_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    phone = await RevealParticipantPii(db).get_phone(enroll_id)

    db.add(
        PiiAccessLog(
            actor_user_id=current_user.id,
            actor_role=getattr(current_user.role, "value", str(current_user.role)),
            target_enroll_id=enroll_id,
            fields="phone",
        )
    )
    await db.commit()

    return {"enroll_id": enroll_id, "phone": phone}


@router.get("/{enroll_id}")
async def get_participant(
    enroll_id: int,
    role: RoleEnum = Query(..., description="Select participant role"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Retrieve specific participant details.**

    **Scenario:**
    Used when viewing a detailed profile of a single person (e.g., clicking on a list entry).
    The `role` is necessary because athletes and staff are in different database tables.

    **Access control:** ORGANIZATION users may only view participants belonging to
    their own organization; admin / super_admin / federation may view any.

    **Success Response:**
    - `200 OK`: Returns the full profile of the Athlete or Leader.

    **Error Cases:**
    - `403 Forbidden`: Participant belongs to another organization.
    - `404 Not Found`: No record exists with the given ID and Role.
    """
    query = ParticipantQuery(db)
    owner_org_id = await query.get_owner_org_id(enroll_id, role)
    if owner_org_id is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    enforce_org_access(current_user, owner_org_id)
    return await query.get_by_id(enroll_id, role)


@router.patch("/update")
async def update_participant(
    request: FastAPIRequest,
    response: Response,
    body: ParticipantUpdateBody = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a registered participant's profile.

    Supports partial updates via the `data` field of the `ParticipantUpdateBody`.

    **Access control:** ORGANIZATION users may only update participants belonging
    to their own organization; admin / super_admin / federation may update any.
    """
    await participant_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    owner_org_id = await ParticipantQuery(db).get_owner_org_id(
        body.enroll_id, body.role
    )
    if owner_org_id is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    enforce_org_access(current_user, owner_org_id)
    return await UpdateParticipant(db).update(
        body.enroll_id, body.role, body.data, current_user
    )


@router.delete("/delete", status_code=status.HTTP_200_OK)
async def delete_participant(
    request: FastAPIRequest,
    response: Response,
    body: ParticipantDeleteBody = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Revoke/Delete a participant's registration record.**

    **Scenario:**
    Used when a participant is disqualified or withdrew from an event.
    **Warning**: This action is PERMANENT and cannot be undone.

    **Access control:** ORGANIZATION users may only delete participants belonging
    to their own organization; admin / super_admin / federation may delete any.

    **Success Response:**
    - `200 OK`: Record deleted successfully.

    **Error Cases:**
    - `403 Forbidden`: Participant belongs to another organization.
    - `404 Not Found`: The participant does not exist.
    """
    await participant_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    owner_org_id = await ParticipantQuery(db).get_owner_org_id(body.enroll_id)
    if owner_org_id is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    enforce_org_access(current_user, owner_org_id)
    return await UpdateParticipant(db).delete(body.enroll_id)
