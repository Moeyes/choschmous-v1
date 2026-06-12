"""Async row factories for tests. Each inserts (and flushes) a real row in the
test session; the savepoint-rollback fixture cleans them up automatically."""

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.category import category
from src.models.enum.event import AgeMode, PhaseStatus, SportMode, eventType
from src.models.enum.org import instituteType
from src.models.enum.user import genderEnum
from src.models.events import Events
from src.models.organization import Organization
from src.models.sport import Sport
from src.models.sports_event import sports_event
from src.models.sports_event_org import sports_event_org

_org_seq = 0


async def make_org(db: AsyncSession, name_kh: str = "ខេត្តសាកល្បង") -> Organization:
    global _org_seq
    _org_seq += 1
    org = Organization(
        name_kh=name_kh, type=instituteType.PROVINCE, code=f"TST{_org_seq:03d}"
    )
    db.add(org)
    await db.flush()
    return org


async def make_sport(db: AsyncSession, name_kh: str = "បាល់ទាត់") -> Sport:
    sport = Sport(name_kh=name_kh, sport_type=name_kh)
    db.add(sport)
    await db.flush()
    return sport


async def make_event(
    db: AsyncSession,
    *,
    registration: PhaseStatus = PhaseStatus.OPEN,
    age_mode: AgeMode | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    start_date: date | None = None,
) -> Events:
    event = Events(
        name_kh="ព្រឹត្តិការណ៍សាកល្បង",
        type=eventType.NATIONAL,
        registration_status=registration,
        age_mode=age_mode,
        age_min=age_min,
        age_max=age_max,
        start_date=start_date,
    )
    db.add(event)
    await db.flush()
    return event


async def make_sports_event(
    db: AsyncSession,
    event: Events,
    sport: Sport,
    *,
    mode: SportMode = SportMode.INDIVIDUAL,
    quota_athletes_per_org: int | None = None,
    quota_teams_per_org: int | None = None,
    team_size_min: int | None = None,
    team_size_max: int | None = None,
) -> sports_event:
    se = sports_event(
        events_id=event.id,
        sports_id=sport.id,
        mode=mode,
        quota_athletes_per_org=quota_athletes_per_org,
        quota_teams_per_org=quota_teams_per_org,
        team_size_min=team_size_min,
        team_size_max=team_size_max,
    )
    db.add(se)
    await db.flush()
    return se


async def link_org_sport(
    db: AsyncSession, event: Events, sport: Sport, org: Organization
) -> sports_event_org:
    link = sports_event_org(
        events_id=event.id, sports_id=sport.id, organization_id=org.id
    )
    db.add(link)
    await db.flush()
    return link


async def make_category(
    db: AsyncSession,
    event: Events,
    sport: Sport,
    *,
    name: str = "U18 បុរស",
    gender: genderEnum = genderEnum.MALE,
) -> category:
    cat = category(
        events_id=event.id, sports_id=sport.id, category=name, gender=gender
    )
    db.add(cat)
    await db.flush()
    return cat
