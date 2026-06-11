from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.organization import Organization
from src.models.events import Events


class ExcelService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_org_sport_category(self, org_id: int, events_id: int):
        # Get org name
        org_query = select(Organization.name_kh).where(Organization.id == org_id)
        org_result = await self.db.execute(org_query)
        org_name = org_result.scalar() or ""

        # Get event name
        event_query = select(Events.name_kh).where(Events.id == events_id)
        event_result = await self.db.execute(event_query)
        event_name = event_result.scalar() or ""

        # Get attended sport categories for this org/event
        from src.models.category import category as Category
        from src.models.sport import Sport
        from src.models.sports_event_org import sports_event_org

        query = (
            select(
                Category.id,
                Sport.name_kh.label("sport_name"),
                Category.category,
                Category.gender,
                Category.created_at,
            )
            .join(Sport, Category.sports_id == Sport.id)
            .join(
                sports_event_org,
                (sports_event_org.sports_id == Category.sports_id)
                & (sports_event_org.organization_id == org_id)
                & (sports_event_org.events_id == events_id),
            )
            .where(Category.events_id == events_id)
        )
        result = await self.db.execute(query)
        categories = result.mappings().all()

        # Prepare response data (only category and gender)
        data = [
            {
                "category": cat["category"],
                "gender": cat["gender"].value.lower() if cat["gender"] else None,
            }
            for cat in categories
        ]

        return {
            "org_name": org_name,
            "event_name": event_name,
            "data": data,
        }

    async def get_org_sport_participant_counts(self, org_id: int, events_id: int):
        # Get org name
        org_query = select(Organization.name_kh).where(Organization.id == org_id)
        org_result = await self.db.execute(org_query)
        org_name = org_result.scalar() or ""

        # Get event name
        event_query = select(Events.name_kh).where(Events.id == events_id)
        event_result = await self.db.execute(event_query)
        event_name = event_result.scalar() or ""

        from src.models.sport import Sport
        from src.models.athlete_participation import athlete_participation
        from src.models.leader_participation import leader_participation
        from src.models.leader import leader as Leader
        from src.models.athletes import athletes as Athletes
        from src.models.enroll import Enroll
        from src.models.enum.user import LeaderRole
        from src.models.sports_event_org import sports_event_org

        # 1. Get all sports for the event that org is attending
        sport_query = (
            select(Sport.id, Sport.name_kh)
            .join(sports_event_org, sports_event_org.sports_id == Sport.id)
            .where(
                sports_event_org.organization_id == org_id,
                sports_event_org.events_id == events_id,
            )
        )
        sports = {s.id: s.name_kh for s in (await self.db.execute(sport_query)).all()}

        # 2. Aggregated athlete counts — one query, all sports
        athlete_query = (
            select(
                athlete_participation.sports_id,
                Enroll.gender,
                func.count().label("cnt"),
            )
            .join(Athletes, athlete_participation.athletes_id == Athletes.id)
            .join(Enroll, Athletes.enroll_id == Enroll.id)
            .where(
                athlete_participation.organization_id == org_id,
                athlete_participation.events_id == events_id,
                athlete_participation.sports_id.in_(sports.keys()),
            )
            .group_by(athlete_participation.sports_id, Enroll.gender)
        )
        athlete_rows = (await self.db.execute(athlete_query)).all()

        # 3. Aggregated leader counts — one query, all sports
        leader_query = (
            select(
                leader_participation.sports_id,
                Leader.LeaderRole,
                Enroll.gender,
                func.count().label("cnt"),
            )
            .join(Leader, leader_participation.leaders_id == Leader.id)
            .join(Enroll, Leader.enroll_id == Enroll.id)
            .where(
                leader_participation.organization_id == org_id,
                leader_participation.events_id == events_id,
                leader_participation.sports_id.in_(sports.keys()),
            )
            .group_by(leader_participation.sports_id, Leader.LeaderRole, Enroll.gender)
        )
        leader_rows = (await self.db.execute(leader_query)).all()

        grand_totals = {
            "delegate_male": 0, "delegate_female": 0,
            "manager_male": 0, "manager_female": 0,
            "coach_male": 0, "coach_female": 0,
            "athlete_male": 0, "athlete_female": 0,
            "total_male": 0, "total_female": 0, "total": 0,
        }

        data = []
        _gender_key = lambda g: g.value.lower() if hasattr(g, "value") else str(g).lower()

        for sport_id, sport_name in sports.items():
            # Aggregate athletes for this sport
            athlete_counts = {"male": 0, "female": 0}
            for sid, gender, cnt in athlete_rows:
                if sid == sport_id:
                    athlete_counts[_gender_key(gender)] = cnt

            # Aggregate leaders for this sport
            role_key_map = {
                LeaderRole.DELEGATE: "delegate",
                LeaderRole.MANAGER: "manager",
                LeaderRole.COACH: "coach",
            }
            role_counts = {
                "delegate_male": 0, "delegate_female": 0,
                "manager_male": 0, "manager_female": 0,
                "coach_male": 0, "coach_female": 0,
            }
            for sid, role, gender, cnt in leader_rows:
                if sid == sport_id:
                    prefix = role_key_map.get(role)
                    if prefix:
                        role_counts[f"{prefix}_{_gender_key(gender)}"] = cnt

            total_male = (
                role_counts["delegate_male"]
                + role_counts["manager_male"]
                + role_counts["coach_male"]
                + athlete_counts["male"]
            )
            total_female = (
                role_counts["delegate_female"]
                + role_counts["manager_female"]
                + role_counts["coach_female"]
                + athlete_counts["female"]
            )
            total = total_male + total_female

            for k in role_counts:
                grand_totals[k] += role_counts[k]
            grand_totals["athlete_male"] += athlete_counts["male"]
            grand_totals["athlete_female"] += athlete_counts["female"]
            grand_totals["total_male"] += total_male
            grand_totals["total_female"] += total_female
            grand_totals["total"] += total

            data.append({
                "sport_id": sport_id,
                "sport_name": sport_name,
                **role_counts,
                "athlete_male": athlete_counts["male"],
                "athlete_female": athlete_counts["female"],
                "total_male": total_male,
                "total_female": total_female,
                "total": total,
            })

        data.append({"sport_id": None, "sport_name": "សរុប", **grand_totals})

        return {
            "org_name": org_name,
            "event_name": event_name,
            "data": data,
        }
