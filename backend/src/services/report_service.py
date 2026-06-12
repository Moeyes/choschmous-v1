from __future__ import annotations

from datetime import date
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.organization import Organization
from src.models.events import Events
from src.models.sport import Sport
from src.models.category import category as Category
from src.models.sports_event_org import sports_event_org
from src.models.enroll import Enroll
from src.models.athletes import athletes as Athletes
from src.models.athlete_participation import athlete_participation
from src.models.leader import leader as Leader
from src.models.leader_participation import leader_participation
from src.models.organizer_participation import OrganizerParticipation
from src.models.organizer_role import OrganizerRole
from src.models.participation_per_sport import participation_per_sport
from src.models.enum.user import LeaderRole, genderEnum


ReportRows = list[dict]


class ReportService:
    """Produces language-neutral row data for each report key."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── helpers ────────────────────────────────────────────────
    _GK = lambda self, g: g.value.lower() if hasattr(g, "value") else str(g).lower()

    async def _get_event(self, event_id: int) -> Events | None:
        return await self.db.get(Events, event_id)

    async def _get_orgs_in_event(self, event_id: int) -> list[Organization]:
        q = (
            select(Organization)
            .distinct()
            .join(sports_event_org, sports_event_org.organization_id == Organization.id)
            .where(sports_event_org.events_id == event_id)
            .order_by(Organization.name_kh)
        )
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def _get_sports_in_event(self, event_id: int) -> list[Sport]:
        from src.models.sports_event import sports_event
        q = (
            select(Sport)
            .join(sports_event, sports_event.sports_id == Sport.id)
            .where(sports_event.events_id == event_id)
            .order_by(Sport.name_kh)
        )
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def _enforce_org_scope(
        self, current_user, org_id: int | None
    ) -> int | None:
        from src.database.deps import get_effective_org_id
        return get_effective_org_id(current_user, org_id)

    # ── 1. sport-list   ចុះប្រភេទកីឡា ─────────────────────────
    async def sport_list(self, event_id: int, current_user) -> ReportRows:
        sports = await self._get_sports_in_event(event_id)
        rows: ReportRows = []
        for idx, s in enumerate(sports, 1):
            # survey ② - how many orgs selected this sport
            org_q = select(sports_event_org).where(
                sports_event_org.events_id == event_id,
                sports_event_org.sports_id == s.id,
            )
            org_r = await self.db.execute(org_q)
            org_count = len(org_r.scalars().all())

            # survey ③ - participation counts
            pps_q = select(
                func.coalesce(func.sum(participation_per_sport.athlete_male_count), 0),
                func.coalesce(func.sum(participation_per_sport.athlete_female_count), 0),
            ).select_from(participation_per_sport).join(
                sports_event_org,
                participation_per_sport.sports_Events_id == sports_event_org.id,
            ).where(
                sports_event_org.events_id == event_id,
                sports_event_org.sports_id == s.id,
            )
            pps_r = await self.db.execute(pps_q)
            male_planned, female_planned = pps_r.one()

            rows.append({
                "no": idx,
                "sport_name_kh": s.name_kh,
                "org_count": org_count,
                "male_planned": int(male_planned or 0),
                "female_planned": int(female_planned or 0),
            })
        return rows

    # ── 2. totals   ចំនួនរួម ─────────────────────────────────────
    async def totals(
        self, event_id: int, current_user, source: str = "planned"
    ) -> ReportRows:
        orgs = await self._get_orgs_in_event(event_id)
        sports = await self._get_sports_in_event(event_id)

        rows: ReportRows = []
        for org in orgs:
            sport_cols: dict[int, dict] = {}
            for s in sports:
                if source == "planned":
                    m, f = await self._planned_counts(event_id, s.id, org.id)
                else:
                    m, f = await self._actual_counts(event_id, s.id, org.id)
                sport_cols[s.id] = {"male": m, "female": f, "total": m + f}

            total_athletes = sum(v["total"] for v in sport_cols.values())

            leader_m, leader_f = await self._leader_totals(event_id, org.id)
            delegate_m, delegate_f = await self._role_counts(event_id, org.id, LeaderRole.DELEGATE)
            coach_m, coach_f = await self._role_counts(event_id, org.id, LeaderRole.COACH)

            grand_total = total_athletes + leader_m + leader_f + delegate_m + delegate_f + coach_m + coach_f

            row = {
                "org_name_kh": org.name_kh,
                "total_delegates": delegate_m + delegate_f,
                "total_leaders": leader_m + leader_f,
                "total_coaches": coach_m + coach_f,
            }
            for s in sports:
                c = sport_cols.get(s.id, {"male": 0, "female": 0})
                row[f"sport_{s.id}_male"] = c["male"]
                row[f"sport_{s.id}_female"] = c["female"]
            row["total_athletes"] = total_athletes
            row["grand_total"] = grand_total
            rows.append(row)
        return rows

    async def _planned_counts(
        self, event_id: int, sport_id: int, org_id: int
    ) -> tuple[int, int]:
        q = select(
            func.coalesce(func.sum(participation_per_sport.athlete_male_count), 0),
            func.coalesce(func.sum(participation_per_sport.athlete_female_count), 0),
        ).select_from(participation_per_sport).join(
            sports_event_org,
            participation_per_sport.sports_Events_id == sports_event_org.id,
        ).where(
            sports_event_org.events_id == event_id,
            sports_event_org.sports_id == sport_id,
            sports_event_org.organization_id == org_id,
        )
        r = await self.db.execute(q)
        row = r.one()
        return int(row[0] or 0), int(row[1] or 0)

    async def _actual_counts(
        self, event_id: int, sport_id: int, org_id: int
    ) -> tuple[int, int]:
        q = (
            select(
                func.count().filter(Enroll.gender == genderEnum.MALE),
                func.count().filter(Enroll.gender == genderEnum.FEMALE),
            )
            .select_from(athlete_participation)
            .join(Athletes, athlete_participation.athletes_id == Athletes.id)
            .join(Enroll, Athletes.enroll_id == Enroll.id)
            .where(
                athlete_participation.events_id == event_id,
                athlete_participation.sports_id == sport_id,
                athlete_participation.organization_id == org_id,
            )
        )
        r = await self.db.execute(q)
        row = r.one()
        return int(row[0] or 0), int(row[1] or 0)

    async def _leader_totals(
        self, event_id: int, org_id: int
    ) -> tuple[int, int]:
        q = (
            select(
                func.count().filter(Enroll.gender == genderEnum.MALE),
                func.count().filter(Enroll.gender == genderEnum.FEMALE),
            )
            .select_from(leader_participation)
            .join(Leader, leader_participation.leaders_id == Leader.id)
            .join(Enroll, Leader.enroll_id == Enroll.id)
            .where(
                leader_participation.events_id == event_id,
                leader_participation.organization_id == org_id,
            )
        )
        r = await self.db.execute(q)
        row = r.one()
        return int(row[0] or 0), int(row[1] or 0)

    async def _role_counts(
        self, event_id: int, org_id: int, role: LeaderRole
    ) -> tuple[int, int]:
        q = (
            select(
                func.count().filter(Enroll.gender == genderEnum.MALE),
                func.count().filter(Enroll.gender == genderEnum.FEMALE),
            )
            .select_from(leader_participation)
            .join(Leader, leader_participation.leaders_id == Leader.id)
            .join(Enroll, Leader.enroll_id == Enroll.id)
            .where(
                leader_participation.events_id == event_id,
                leader_participation.organization_id == org_id,
                Leader.LeaderRole == role,
            )
        )
        r = await self.db.execute(q)
        row = r.one()
        return int(row[0] or 0), int(row[1] or 0)

    # ── 3. counts   ចុះចំនួន ─────────────────────────────────────
    async def counts(self, event_id: int, current_user) -> ReportRows:
        sports = await self._get_sports_in_event(event_id)
        rows: ReportRows = []
        grand_delegates = grand_leaders = grand_coaches = grand_athletes = 0

        for idx, s in enumerate(sports, 1):
            delegates_m = delegates_f = 0
            leaders_m = leaders_f = 0
            coaches_m = coaches_f = 0
            athletes_m = athletes_f = 0

            orgs = await self._get_orgs_for_sport(event_id, s.id)
            for org in orgs:
                dm, df = await self._role_counts(event_id, org.id, LeaderRole.DELEGATE)
                lm, lf = await self._leader_totals(event_id, org.id)
                cm, cf = await self._role_counts(event_id, org.id, LeaderRole.COACH)
                am, af = await self._actual_counts(event_id, s.id, org.id)
                delegates_m += dm
                delegates_f += df
                leaders_m += lm
                leaders_f += lf
                coaches_m += cm
                coaches_f += cf
                athletes_m += am
                athletes_f += af

            sport_total = delegates_m + delegates_f + leaders_m + leaders_f + coaches_m + coaches_f + athletes_m + athletes_f
            grand_delegates += delegates_m + delegates_f
            grand_leaders += leaders_m + leaders_f
            grand_coaches += coaches_m + coaches_f
            grand_athletes += athletes_m + athletes_f

            rows.append({
                "no": idx,
                "sport_name_kh": s.name_kh,
                "delegates": delegates_m + delegates_f,
                "leaders": leaders_m + leaders_f,
                "coaches": coaches_m + coaches_f,
                "athletes": athletes_m + athletes_f,
                "total": sport_total,
            })

        grand_total = grand_delegates + grand_leaders + grand_coaches + grand_athletes
        rows.append({
            "no": None,
            "sport_name_kh": "\u179F\u17BB\u179A\u17BB\u1794",
            "delegates": grand_delegates,
            "leaders": grand_leaders,
            "coaches": grand_coaches,
            "athletes": grand_athletes,
            "total": grand_total,
        })
        return rows

    async def _get_orgs_for_sport(self, event_id: int, sport_id: int) -> list[Organization]:
        q = (
            select(Organization)
            .join(sports_event_org, sports_event_org.organization_id == Organization.id)
            .where(
                sports_event_org.events_id == event_id,
                sports_event_org.sports_id == sport_id,
            )
            .order_by(Organization.name_kh)
        )
        r = await self.db.execute(q)
        return list(r.scalars().all())

    # ── 4. album   អាល់ប៊ុម ──────────────────────────────────────
    async def album(self, event_id: int, current_user) -> ReportRows:
        orgs = await self._get_orgs_in_event(event_id)
        rows: ReportRows = []
        for org in orgs:
            athletes = await self._enrolled_athletes(event_id, org.id)
            leaders = await self._enrolled_leaders(event_id, org.id)
            for p in leaders:
                rows.append({**p, "group": "leadership"})
            for p in athletes:
                rows.append({**p, "group": "athlete"})
        return rows

    async def _enrolled_athletes(self, event_id: int, org_id: int) -> ReportRows:
        q = (
            select(
                Enroll.kh_family_name, Enroll.kh_given_name,
                Enroll.gender, Enroll.nationality,
                Enroll.en_family_name, Enroll.en_given_name,
                Enroll.date_of_birth, Enroll.address,
                Enroll.id_document_type,
                Enroll.phonenumber,
                Enroll.photo_path,
            )
            .select_from(athlete_participation)
            .join(Athletes, athlete_participation.athletes_id == Athletes.id)
            .join(Enroll, Athletes.enroll_id == Enroll.id)
            .where(
                athlete_participation.events_id == event_id,
                athlete_participation.organization_id == org_id,
            )
            .distinct()
            .order_by(Enroll.kh_family_name, Enroll.kh_given_name)
        )
        r = await self.db.execute(q)
        rows = r.mappings().all()
        result: ReportRows = []
        for row in rows:
            d = dict(row)
            d["role"] = "\u1780\u17D2\u179F\u17B6\u1792\u1780\u179A"  # កីឡាករ
            if d.get("gender"):
                d["gender"] = self._GK(d["gender"])
            result.append(d)
        return result

    async def _enrolled_leaders(self, event_id: int, org_id: int) -> ReportRows:
        q = (
            select(
                Enroll.kh_family_name, Enroll.kh_given_name,
                Enroll.gender, Enroll.nationality,
                Enroll.en_family_name, Enroll.en_given_name,
                Enroll.date_of_birth, Enroll.address,
                Enroll.id_document_type,
                Enroll.phonenumber,
                Enroll.photo_path,
                Leader.LeaderRole,
            )
            .select_from(leader_participation)
            .join(Leader, leader_participation.leaders_id == Leader.id)
            .join(Enroll, Leader.enroll_id == Enroll.id)
            .where(
                leader_participation.events_id == event_id,
                leader_participation.organization_id == org_id,
            )
            .distinct()
            .order_by(Enroll.kh_family_name, Enroll.kh_given_name)
        )
        r = await self.db.execute(q)
        rows = r.mappings().all()
        result: ReportRows = []
        for row in rows:
            d = dict(row)
            d["role"] = d.pop("LeaderRole", "") or ""
            if isinstance(d.get("role"), LeaderRole):
                d["role"] = d["role"].value
            if d.get("gender"):
                d["gender"] = self._GK(d["gender"])
            result.append(d)
        return result

    # ── 5. name-list   រាយនាមរួម ─────────────────────────────────
    async def name_list(self, event_id: int, current_user) -> ReportRows:
        orgs = await self._get_orgs_in_event(event_id)
        rows: ReportRows = []
        for org in orgs:
            athletes = await self._enrolled_athletes(event_id, org.id)
            for a in athletes:
                a["org_name_kh"] = org.name_kh
                a["org_name_en"] = org.name_en
            leaders = await self._enrolled_leaders(event_id, org.id)
            for l in leaders:
                l["org_name_kh"] = org.name_kh
                l["org_name_en"] = org.name_en

            for idx, p in enumerate(athletes + leaders, 1):
                p["no"] = idx
                p["category_sport"] = await self._athlete_categories(
                    event_id, org.id, p.get("en_family_name", ""), p.get("en_given_name", "")
                )
                rows.append(p)
        return rows

    async def _athlete_categories(
        self, event_id: int, org_id: int, en_family: str, en_given: str
    ) -> str:
        q = (
            select(
                Sport.name_kh,
                Category.category,
            )
            .select_from(athlete_participation)
            .join(Athletes, athlete_participation.athletes_id == Athletes.id)
            .join(Enroll, Athletes.enroll_id == Enroll.id)
            .join(Sport, athlete_participation.sports_id == Sport.id)
            .join(Category, athlete_participation.category_id == Category.id)
            .where(
                athlete_participation.events_id == event_id,
                athlete_participation.organization_id == org_id,
                Enroll.en_family_name == en_family,
                Enroll.en_given_name == en_given,
            )
        )
        r = await self.db.execute(q)
        cats = r.all()
        return ", ".join(f"{c[0]}-{c[1]}" for c in cats)

    # ── 6. leaders   ថ្នាក់ដឹកនាំ ────────────────────────────────
    async def leaders_report(self, event_id: int, current_user) -> ReportRows:
        orgs = await self._get_orgs_in_event(event_id)
        rows: ReportRows = []
        for org in orgs:
            leaders = await self._enrolled_leaders(event_id, org.id)
            for l in leaders:
                l["org_name_kh"] = org.name_kh
                l["org_name_en"] = org.name_en
            rows.extend(leaders)
        return rows

    # ── 7. coach-athlete   គ្រូបង្វឹក អត្តពលិក ─────────────────
    async def coach_athlete(self, event_id: int, current_user) -> ReportRows:
        orgs = await self._get_orgs_in_event(event_id)
        rows: ReportRows = []
        for org in orgs:
            sports = await self._get_sports_for_org(event_id, org.id)
            for s in sports:
                coaches = await self._coaches_for_sport(event_id, s.id, org.id)
                athletes = await self._athletes_for_sport(event_id, s.id, org.id)
                for c in coaches:
                    c["sport_name_kh"] = s.name_kh
                    c["role_label"] = c.get("role", "")
                    c["org_name_kh"] = org.name_kh
                    rows.append(c)
                for a in athletes:
                    a["sport_name_kh"] = s.name_kh
                    a["role_label"] = self._gender_athlete_label(a.get("gender", ""))
                    a["org_name_kh"] = org.name_kh
                    rows.append(a)
        return rows

    async def _get_sports_for_org(self, event_id: int, org_id: int) -> list[Sport]:
        q = (
            select(Sport)
            .join(sports_event_org, sports_event_org.sports_id == Sport.id)
            .where(
                sports_event_org.events_id == event_id,
                sports_event_org.organization_id == org_id,
            )
            .order_by(Sport.name_kh)
        )
        r = await self.db.execute(q)
        return list(r.scalars().all())

    async def _coaches_for_sport(self, event_id: int, sport_id: int, org_id: int) -> ReportRows:
        q = (
            select(
                Enroll.kh_family_name, Enroll.kh_given_name,
                Enroll.gender, Enroll.date_of_birth,
                Enroll.en_family_name, Enroll.en_given_name,
                Leader.LeaderRole.label("role"),
            )
            .select_from(leader_participation)
            .join(Leader, leader_participation.leaders_id == Leader.id)
            .join(Enroll, Leader.enroll_id == Enroll.id)
            .where(
                leader_participation.events_id == event_id,
                leader_participation.sports_id == sport_id,
                leader_participation.organization_id == org_id,
                Leader.LeaderRole.in_([LeaderRole.COACH, LeaderRole.COACH_TRAINER]),
            )
            .distinct()
        )
        r = await self.db.execute(q)
        rows = r.mappings().all()
        result: ReportRows = []
        for row in rows:
            d = dict(row)
            if d.get("gender"):
                d["gender"] = self._GK(d["gender"])
            if isinstance(d.get("role"), LeaderRole):
                d["role"] = d["role"].value
            result.append(d)
        return result

    async def _athletes_for_sport(self, event_id: int, sport_id: int, org_id: int) -> ReportRows:
        q = (
            select(
                Enroll.kh_family_name, Enroll.kh_given_name,
                Enroll.gender, Enroll.date_of_birth,
                Enroll.en_family_name, Enroll.en_given_name,
                Category.category,
            )
            .select_from(athlete_participation)
            .join(Athletes, athlete_participation.athletes_id == Athletes.id)
            .join(Enroll, Athletes.enroll_id == Enroll.id)
            .outerjoin(Category, athlete_participation.category_id == Category.id)
            .where(
                athlete_participation.events_id == event_id,
                athlete_participation.sports_id == sport_id,
                athlete_participation.organization_id == org_id,
            )
            .distinct()
        )
        r = await self.db.execute(q)
        rows = r.mappings().all()
        result: ReportRows = []
        for row in rows:
            d = dict(row)
            if d.get("gender"):
                d["gender"] = self._GK(d["gender"])
            result.append(d)
        return result

    @staticmethod
    def _gender_athlete_label(gender: str) -> str:
        if gender in ("male", "MALE"):
            return "\u1780\u17D2\u179F\u17B6\u1792\u1780\u179A"  # កីឡាករ
        elif gender in ("female", "FEMALE"):
            return "\u1780\u17D2\u179F\u17B6\u1792\u1780\u17B6\u179A\u17D2\u1793\u17B8"  # កីឡាការិនី
        return "\u1780\u17D2\u179F\u17B6\u1792\u1780\u179A"

    # ── 8. delegation   ប្រតិភូ អ្នកដឹកនាំ ────────────────────
    async def delegation(self, event_id: int, current_user) -> ReportRows:
        q = (
            select(
                Enroll.kh_family_name, Enroll.kh_given_name,
                Enroll.gender, Enroll.phonenumber,
                OrganizerRole.name_kh.label("role_name_kh"),
                OrganizerRole.name_en.label("role_name_en"),
                Organization.name_kh.label("org_name_kh"),
                Sport.name_kh.label("sport_name_kh"),
            )
            .select_from(OrganizerParticipation)
            .join(Enroll, OrganizerParticipation.enroll_id == Enroll.id)
            .join(OrganizerRole, OrganizerParticipation.organizer_role_id == OrganizerRole.id)
            .outerjoin(Organization, OrganizerParticipation.organization_id == Organization.id)
            .outerjoin(sports_event_org, and_(
                sports_event_org.events_id == OrganizerParticipation.event_id,
                sports_event_org.organization_id == OrganizerParticipation.organization_id,
            ))
            .outerjoin(Sport, sports_event_org.sports_id == Sport.id)
            .where(OrganizerParticipation.event_id == event_id)
            .order_by(Organization.name_kh, OrganizerRole.name_kh)
        )
        r = await self.db.execute(q)
        rows = r.mappings().all()
        result: ReportRows = []
        for row in rows:
            d = dict(row)
            if d.get("gender"):
                d["gender"] = self._GK(d["gender"])
            result.append(d)
        return result
