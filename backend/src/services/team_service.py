import logging

from fastapi import HTTPException
from sqlalchemy import func, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.team import team as Team
from src.models.athlete_participation import (
    athlete_participation as AthleteParticipation,
)
from src.models.athletes import athletes as Athlete
from src.models.enroll import Enroll
from src.models.sports_event import sports_event as SportsEvent
from src.models.events import Events
from src.schemas.team import TeamCreate, TeamUpdate

logger = logging.getLogger(__name__)


class TeamService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _raise(status_code: int, code: str, message: str, **params):
        detail = {"code": code, "message": message}
        if params:
            detail["params"] = params
        raise HTTPException(status_code=status_code, detail=detail)

    async def create_team(self, data: TeamCreate) -> Team:
        event = await self.db.get(Events, data.event_id)
        if not event:
            self._raise(404, "EVENT_NOT_FOUND", "Event not found.")

        if not event.registration_is_open:
            self._raise(
                403, "REGISTRATION_CLOSED", "Registration is not open for this event."
            )

        config = (
            await self.db.execute(
                select(SportsEvent).where(
                    SportsEvent.events_id == data.event_id,
                    SportsEvent.sports_id == data.sport_id,
                )
            )
        ).scalar_one_or_none()

        if not config:
            self._raise(
                404, "SPORT_NOT_IN_EVENT", "This sport is not linked to the event."
            )

        if config.mode.value not in ("team", "both"):
            self._raise(
                422,
                "TEAM_MODE_DISALLOWED",
                "This sport does not allow team registration.",
                mode=config.mode.value,
            )

        if config.quota_teams_per_org is not None:
            used = (
                await self.db.execute(
                    select(func.count())
                    .select_from(Team)
                    .where(
                        Team.event_id == data.event_id,
                        Team.sport_id == data.sport_id,
                        Team.org_id == data.org_id,
                    )
                )
            ).scalar() or 0
            if used >= config.quota_teams_per_org:
                self._raise(
                    409,
                    "TEAM_QUOTA_FULL",
                    "The team quota for this sport is full.",
                    used=used,
                    quota=config.quota_teams_per_org,
                )

        existing = (
            await self.db.execute(
                select(Team.id).where(
                    Team.event_id == data.event_id,
                    Team.sport_id == data.sport_id,
                    Team.org_id == data.org_id,
                    Team.category_id == data.category_id,
                    Team.name == data.name,
                )
            )
        ).scalar_one_or_none()
        if existing:
            self._raise(
                409,
                "TEAM_NAME_TAKEN",
                "A team with this name already exists for your org "
                "in this sport and category.",
            )

        team = Team(**data.model_dump())
        self.db.add(team)
        await self.db.commit()
        await self.db.refresh(team)
        return team

    async def list_teams(self, event_id: int | None, org_id: int | None) -> list[dict]:
        query = select(Team)
        if event_id is not None:
            query = query.where(Team.event_id == event_id)
        if org_id is not None:
            query = query.where(Team.org_id == org_id)
        query = query.order_by(Team.created_at.desc())
        result = await self.db.execute(query)
        teams = result.scalars().all()

        out = []
        for t in teams:
            count = await self.member_count(t.id)
            out.append(
                {
                    "id": t.id,
                    "event_id": t.event_id,
                    "sport_id": t.sport_id,
                    "org_id": t.org_id,
                    "category_id": t.category_id,
                    "name": t.name,
                    "member_count": count,
                    "created_at": t.created_at,
                }
            )
        return out

    async def get_team(self, team_id: int) -> Team | None:
        return await self.db.get(Team, team_id)

    async def get_team_detail(self, team_id: int) -> dict | None:
        t = await self.db.get(Team, team_id)
        if not t:
            return None

        from datetime import date as date_type

        members_query = (
            select(
                Enroll.id.label("enroll_id"),
                Enroll.kh_family_name,
                Enroll.kh_given_name,
                Enroll.en_family_name,
                Enroll.en_given_name,
                Enroll.gender,
                Enroll.photo_path.label("photo_url"),
                Enroll.date_of_birth,
                Enroll.birth_certificate_path,
                Enroll.national_id_path,
                Enroll.passport_path,
            )
            .join(Athlete, Athlete.enroll_id == Enroll.id)
            .join(
                AthleteParticipation,
                AthleteParticipation.athletes_id == Athlete.id,
            )
            .where(AthleteParticipation.team_id == team_id)
        )
        members_result = await self.db.execute(members_query)
        today = date_type.today()
        members = []
        for m in members_result.mappings().all():
            age = today.year - m.date_of_birth.year
            if (today.month, today.day) < (m.date_of_birth.month, m.date_of_birth.day):
                age -= 1

            if age < 18:
                docs_ok = bool(m.birth_certificate_path) and bool(m.photo_url)
            else:
                docs_ok = bool(m.national_id_path or m.passport_path) and bool(
                    m.photo_url
                )

            members.append(
                {
                    "enroll_id": m.enroll_id,
                    "kh_family_name": m.kh_family_name,
                    "kh_given_name": m.kh_given_name,
                    "en_family_name": m.en_family_name,
                    "en_given_name": m.en_given_name,
                    "gender": m.gender.value
                    if hasattr(m.gender, "value")
                    else str(m.gender),
                    "photo_url": m.photo_url,
                    "status": "complete" if docs_ok else "incomplete",
                }
            )

        return {
            "id": t.id,
            "event_id": t.event_id,
            "sport_id": t.sport_id,
            "org_id": t.org_id,
            "category_id": t.category_id,
            "name": t.name,
            "member_count": len(members),
            "members": members,
            "created_at": t.created_at,
        }

    async def add_member(self, team_id: int, enroll_id: int):
        team = await self.db.get(Team, team_id)
        if not team:
            self._raise(404, "TEAM_NOT_FOUND", "Team not found.")

        config = (
            await self.db.execute(
                select(SportsEvent).where(
                    SportsEvent.events_id == team.event_id,
                    SportsEvent.sports_id == team.sport_id,
                )
            )
        ).scalar_one_or_none()

        current_count = await self.member_count(team_id)
        if (
            config
            and config.team_size_max is not None
            and current_count >= config.team_size_max
        ):
            self._raise(
                409,
                "TEAM_FULL",
                "The team has reached its maximum size.",
                max=config.team_size_max,
            )

        athlete_subq = (
            select(Athlete.id).where(Athlete.enroll_id == enroll_id).subquery()
        )
        part = (
            await self.db.execute(
                select(AthleteParticipation).where(
                    AthleteParticipation.athletes_id == athlete_subq.c.id,
                    AthleteParticipation.events_id == team.event_id,
                    AthleteParticipation.sports_id == team.sport_id,
                    AthleteParticipation.organization_id == team.org_id,
                )
            )
        ).scalar_one_or_none()

        if not part:
            self._raise(
                404,
                "MEMBER_NOT_FOUND",
                "The athlete is not registered in this event/sport/org.",
            )

        if part.team_id is not None:
            self._raise(409, "ALREADY_ON_TEAM", "This athlete is already on a team.")

        if team.category_id is not None and part.category_id != team.category_id:
            self._raise(
                422,
                "CATEGORY_MISMATCH",
                "The athlete's category does not match the team's category.",
            )

        part.team_id = team_id
        await self.db.commit()

    async def finalize_team(self, team_id: int):
        """Finalize a team for registration — the lower-bound counterpart to the
        ``team_size_max`` (``TEAM_FULL``) gate in ``add_member``. Enforces the
        sport's configured minimum roster size; reuses the same team-scoped
        ``SportsEvent`` config lookup. The minimum is enforced only here (at
        finalize), never on member-add, so partial teams can still be built up.
        Skipped when no minimum is configured (null / 0 → vacuously valid)."""
        team = await self.db.get(Team, team_id)
        if not team:
            self._raise(404, "TEAM_NOT_FOUND", "Team not found.")

        config = (
            await self.db.execute(
                select(SportsEvent).where(
                    SportsEvent.events_id == team.event_id,
                    SportsEvent.sports_id == team.sport_id,
                )
            )
        ).scalar_one_or_none()

        if config and config.team_size_min:
            current_count = await self.member_count(team_id)
            if current_count < config.team_size_min:
                self._raise(
                    409,
                    "TEAM_BELOW_MIN",
                    "The team has not reached its minimum size.",
                    min=config.team_size_min,
                    current=current_count,
                )

    async def remove_member(self, team_id: int, enroll_id: int):
        team = await self.db.get(Team, team_id)
        if not team:
            self._raise(404, "TEAM_NOT_FOUND", "Team not found.")

        athlete_subq = (
            select(Athlete.id).where(Athlete.enroll_id == enroll_id).subquery()
        )
        part = (
            await self.db.execute(
                select(AthleteParticipation).where(
                    AthleteParticipation.athletes_id == athlete_subq.c.id,
                    AthleteParticipation.team_id == team_id,
                )
            )
        ).scalar_one_or_none()

        if not part:
            self._raise(404, "MEMBER_NOT_FOUND", "This athlete is not on this team.")

        part.team_id = None
        await self.db.commit()

    async def delete_team(self, team_id: int) -> bool:
        team = await self.db.get(Team, team_id)
        if not team:
            return False

        # Detach members, do NOT delete their registrations. Mirrors remove_member
        # (team_id = None) and the athlete_participation FK (ondelete="SET NULL"):
        # each athlete's registration survives, just unlinked from the deleted team.
        await self.db.execute(
            sa_update(AthleteParticipation)
            .where(AthleteParticipation.team_id == team_id)
            .values(team_id=None)
        )
        await self.db.flush()

        await self.db.delete(team)
        await self.db.commit()
        return True

    async def update_team(self, team_id: int, data: TeamUpdate) -> Team | None:
        team = await self.db.get(Team, team_id)
        if not team:
            return None

        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(team, field, value)
        await self.db.commit()
        await self.db.refresh(team)
        return team

    async def member_count(self, team_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(AthleteParticipation)
            .where(AthleteParticipation.team_id == team_id)
        )
        return result.scalar() or 0

    async def _check_org_access(self, team_id: int, org_id: int):
        """Verify team belongs to the given org. Raised for pre-validation in
        routes that receive the org_id separately."""
        team = await self.db.get(Team, team_id)
        if not team:
            self._raise(404, "TEAM_NOT_FOUND", "Team not found.")
        if team.org_id != org_id:
            self._raise(
                403, "ORG_MISMATCH", "This team does not belong to your organization."
            )
        return team
