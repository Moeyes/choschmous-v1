from datetime import date
from typing import Dict, List, Optional
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.cache import cache_get, cache_set
from src.models.athletes import Athlete
from src.models.athlete_participation import AthleteParticipation
from src.models.enroll import Enroll
from src.models.events import Events
from src.models.enum.event import PhaseStatus
from src.models.organization import Organization
from src.models.sport import Sport
from src.models.leader import Leader
from src.models.participation_per_sport import ParticipationPerSport
from src.models.category_survey_review import CategorySurveyReview

DASHBOARD_CACHE_TTL = 120  # 2 minutes

# Review FSM "awaiting admin action" state (shared by both review surfaces).
_REVIEW_PENDING_STATUS = "SUBMITTED"


async def get_registration_window(db: AsyncSession) -> dict:
    """System-wide registration-window status for the dashboard status line.

    Registration windows are per-event; this aggregates them into one headline:

    * ``open``      — at least one event's registration is open right now;
                      ``closesOn`` is the soonest upcoming close date among them.
    * ``scheduled`` — none open now, but an AUTO-status event opens in the
                      future; ``opensOn`` is the nearest such date.
    * ``closed``    — events exist but none are open or upcoming.
    * ``unknown``   — no events at all (neutral state, no fabricated dates).

    Dates only (Public scheduling data — no PII). Events is a small reference
    table, so reading them all is fine here.
    """
    events = (await db.execute(select(Events))).scalars().all()
    if not events:
        return {"status": "unknown", "opensOn": None, "closesOn": None}

    today = date.today()
    open_close_dates: list[date] = []
    upcoming_open_dates: list[date] = []
    for ev in events:
        if ev.registration_is_open:
            if ev.registration_close_date is not None:
                open_close_dates.append(ev.registration_close_date)
        elif (
            ev.registration_status == PhaseStatus.AUTO
            and ev.registration_open_date is not None
            and ev.registration_open_date > today
        ):
            upcoming_open_dates.append(ev.registration_open_date)

    # An event can be open with no close date set (manual OPEN) — still "open".
    if any(ev.registration_is_open for ev in events):
        closes = min(open_close_dates).isoformat() if open_close_dates else None
        return {"status": "open", "opensOn": None, "closesOn": closes}
    if upcoming_open_dates:
        return {
            "status": "scheduled",
            "opensOn": min(upcoming_open_dates).isoformat(),
            "closesOn": None,
        }
    return {"status": "closed", "opensOn": None, "closesOn": None}


async def get_review_pending_count(db: AsyncSession, *, is_reviewer: bool) -> dict:
    """Count submissions awaiting admin review (by-number + by-category).

    Only reviewers (ADMIN / SUPER_ADMIN) have a review queue; everyone else gets
    zero so the nav badge simply renders nothing without a 403. Counted in SQL,
    never load-all-then-len.
    """
    if not is_reviewer:
        return {"pending": 0, "byNumber": 0, "byCategory": 0}

    by_number = (
        await db.execute(
            select(func.count(ParticipationPerSport.id)).where(
                ParticipationPerSport.status == _REVIEW_PENDING_STATUS
            )
        )
    ).scalar() or 0
    by_category = (
        await db.execute(
            select(func.count(CategorySurveyReview.id)).where(
                CategorySurveyReview.status == _REVIEW_PENDING_STATUS
            )
        )
    ).scalar() or 0
    return {
        "pending": by_number + by_category,
        "byNumber": by_number,
        "byCategory": by_category,
    }


def _scope(org_id: Optional[int]) -> str:
    return f"org_{org_id}" if org_id else "global"


async def get_dashboard_stats(db: AsyncSession, org_id: Optional[int] = None) -> dict:
    """Exact dashboard counts.

    `participants` and `Athlete` are scoped to ``org_id`` when provided
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

    participants_q = select(func.count(AthleteParticipation.id))
    athletes_q = select(func.count(func.distinct(AthleteParticipation.athletes_id)))
    if org_id is not None:
        participants_q = participants_q.where(
            AthleteParticipation.organization_id == org_id
        )
        athletes_q = athletes_q.where(AthleteParticipation.organization_id == org_id)

    stmt = select(
        (select(func.count(Events.id)).scalar_subquery()).label("events"),
        (select(func.count(Sport.id)).scalar_subquery()).label("sports"),
        participants_q.scalar_subquery().label("participants"),
        (select(func.count(Enroll.id)).scalar_subquery()).label("registrations"),
        (select(func.count(Organization.id)).scalar_subquery()).label("organizations"),
        athletes_q.scalar_subquery().label("athletes"),
        (select(func.count(Leader.id)).scalar_subquery()).label("leaders"),
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
            func.count(AthleteParticipation.id).label("participant_count"),
        )
        .outerjoin(
            AthleteParticipation,
            AthleteParticipation.organization_id == Organization.id,
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
            .join(Athlete, Athlete.enroll_id == Enroll.id)
            .join(
                AthleteParticipation, AthleteParticipation.athletes_id == Athlete.id
            )
            .where(AthleteParticipation.organization_id == org_id)
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
