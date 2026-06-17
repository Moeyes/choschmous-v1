from typing import Dict, List, Optional
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.cache import cache_get, cache_set
from src.models.athletes import athletes
from src.models.athlete_participation import athlete_participation
from src.models.enroll import Enroll
from src.models.events import Events
from src.models.organization import Organization
from src.models.sport import Sport
from src.models.leader import leader

DASHBOARD_CACHE_TTL = 120  # 2 minutes


def _scope(org_id: Optional[int]) -> str:
    return f"org_{org_id}" if org_id else "global"


async def get_dashboard_stats(db: AsyncSession, org_id: Optional[int] = None) -> dict:
    """Exact dashboard counts.

    `participants` and `athletes` are scoped to ``org_id`` when provided
    (organization-role users); the remaining figures are global. Both the
    global (admin) and org-scoped paths run real ``COUNT`` queries — never
    ``pg_class.reltuples`` estimates, which read 0 until autovacuum ANALYZEs a
    freshly-seeded table and were the cause of the all-zero admin dashboard.
    The result is cached in Redis for a short TTL and invalidated on writes.
    """
    cache_key = f"dashboard:stats:{_scope(org_id)}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    participants_q = select(func.count(athlete_participation.id))
    athletes_q = select(func.count(func.distinct(athlete_participation.athletes_id)))
    if org_id is not None:
        participants_q = participants_q.where(
            athlete_participation.organization_id == org_id
        )
        athletes_q = athletes_q.where(athlete_participation.organization_id == org_id)

    stmt = select(
        (select(func.count(Events.id)).scalar_subquery()).label("events"),
        (select(func.count(Sport.id)).scalar_subquery()).label("sports"),
        participants_q.scalar_subquery().label("participants"),
        (select(func.count(Enroll.id)).scalar_subquery()).label("registrations"),
        (select(func.count(Organization.id)).scalar_subquery()).label("organizations"),
        athletes_q.scalar_subquery().label("athletes"),
        (select(func.count(leader.id)).scalar_subquery()).label("leaders"),
    )
    row = await db.execute(stmt)
    result = dict(row.first()._mapping)

    await cache_set(cache_key, result, DASHBOARD_CACHE_TTL)
    return result


async def get_dashboard_events(
    db: AsyncSession, limit: int = 10, org_id: Optional[int] = None
) -> List[Events]:
    stmt = (
        select(Events).order_by(desc(Events.created_at), desc(Events.id)).limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_dashboard_sports(
    db: AsyncSession, limit: int = 10, org_id: Optional[int] = None
) -> List[Sport]:
    stmt = select(Sport).order_by(desc(Sport.created_at), desc(Sport.id)).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_dashboard_top_organizations(
    db: AsyncSession, limit: int = 5, org_id: Optional[int] = None
) -> List[tuple]:
    cache_key = f"dashboard:top_orgs:{_scope(org_id)}:{limit}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return [tuple(item) for item in cached]

    stmt = (
        select(
            Organization.name_kh,
            Organization.type,
            func.count(athlete_participation.id).label("participant_count"),
        )
        .outerjoin(
            athlete_participation,
            athlete_participation.organization_id == Organization.id,
        )
        .group_by(Organization.id, Organization.name_kh, Organization.type)
        .order_by(desc("participant_count"), desc(Organization.id))
        .limit(limit)
    )
    if org_id is not None:
        stmt = stmt.where(Organization.id == org_id)
    result = await db.execute(stmt)
    rows = result.all()
    await cache_set(cache_key, [list(r) for r in rows], DASHBOARD_CACHE_TTL)
    return rows


async def get_dashboard_recent_enrollments(
    db: AsyncSession, limit: int = 10
) -> List[Enroll]:
    stmt = (
        select(Enroll).order_by(desc(Enroll.created_at), desc(Enroll.id)).limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_dashboard_gender_distribution(
    db: AsyncSession, org_id: Optional[int] = None
) -> Dict[str, int]:
    cache_key = f"dashboard:gender:{_scope(org_id)}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    if org_id is not None:
        stmt = (
            select(Enroll.gender, func.count(Enroll.id))
            .join(athletes, athletes.enroll_id == Enroll.id)
            .join(
                athlete_participation, athlete_participation.athletes_id == athletes.id
            )
            .where(athlete_participation.organization_id == org_id)
            .group_by(Enroll.gender)
        )
    else:
        stmt = select(Enroll.gender, func.count(Enroll.id)).group_by(Enroll.gender)
    result = await db.execute(stmt)
    counts = result.all()

    distribution = {"male": 0, "female": 0, "other": 0}
    for gender, count in counts:
        key = getattr(gender, "value", str(gender)).lower()
        if key in distribution:
            distribution[key] = count

    await cache_set(cache_key, distribution, DASHBOARD_CACHE_TTL)
    return distribution
