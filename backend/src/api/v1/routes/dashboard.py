from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from core.ratelimit import dashboard_limiter

from src.schemas.dashboard import (
    DashboardData,
    DashboardResponse,
    GenderDistribution,
    StatsResponse,
    format_events,
    format_recent_enrollments,
    format_sports,
    format_top_organizations,
)
from src.database.deps import get_read_db, get_current_user, get_effective_org_id
from src.models.user import User
from src.services import dashboard_service

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_read_db),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    """
    **Retrieve high-level Dashboard Stats and Trends.**

    Requires authentication. Organization-role users see data scoped to their
    own organization. Admin and super_admin see global stats.
    """
    await dashboard_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    org_id = get_effective_org_id(current_user, None)

    stats = await dashboard_service.get_dashboard_stats(db, org_id=org_id)
    events = await dashboard_service.get_dashboard_events(db, org_id=org_id)
    sports = await dashboard_service.get_dashboard_sports(db, org_id=org_id)
    top_orgs = await dashboard_service.get_dashboard_top_organizations(
        db, org_id=org_id
    )
    enrollments = await dashboard_service.get_dashboard_recent_enrollments(db)
    gender_dist = await dashboard_service.get_dashboard_gender_distribution(
        db, org_id=org_id
    )

    dashboard_data = DashboardData(
        stats=StatsResponse(**stats),
        events=format_events(events),
        sports=format_sports(sports),
        topOrganizations=format_top_organizations(top_orgs),
        recentEnrollments=format_recent_enrollments(enrollments),
        genderDistribution=GenderDistribution(**gender_dist),
    )

    return DashboardResponse(success=True, data=dashboard_data)
