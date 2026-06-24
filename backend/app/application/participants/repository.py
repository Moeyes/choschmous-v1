"""Participant data-access (CHOS-206).

Owns the SQL query builders + owner lookup shared by the participants
use-cases. Extracted verbatim from ParticipantService._build_athlete_query /
_build_leader_query / _build_list_query / get_owner_org_id.
"""

from sqlalchemy import (
    cast,
    func,
    Integer,
    literal,
    select,
    String,
    Text,
    union_all,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.enroll import Enroll
from src.models.athletes import athletes as Athlete
from src.models.athlete_participation import (
    athlete_participation as AthleteParticipation,
)
from src.models.leader import leader as Leader
from src.models.leader_participation import leader_participation as LeaderParticipation
from src.models.sport import Sport
from src.models.events import Events
from src.models.organization import Organization
from src.models.category import category as CategoryModel

from src.schemas.enroll import ParticipantFilterParams


class ParticipantRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def build_athlete_query(self):
        """Build the SELECT + JOIN chain for athletes."""
        return (
            select(
                Enroll.id.label("participant_id"),
                Enroll.kh_family_name,
                Enroll.kh_given_name,
                Enroll.en_family_name,
                Enroll.en_given_name,
                Enroll.gender,
                Enroll.date_of_birth.label("date_of_birth"),
                Enroll.phonenumber,
                Enroll.photo_path.label("photoUrl"),
                Enroll.nationality_document_path.label("nationalityDocumentUrl"),
                Enroll.birth_certificate_path.label("birthCertificateUrl"),
                Enroll.national_id_path.label("nationalIdUrl"),
                Enroll.passport_path.label("passportUrl"),
                Enroll.created_at.label("created_at"),
                Sport.id.label("sport_id"),
                Sport.name_kh.label("sport_name"),
                Organization.id.label("org_id"),
                Organization.name_kh.label("org_name"),
                CategoryModel.id.label("category_id"),
                CategoryModel.category.label("category_name"),
                AthleteParticipation.events_id.label("event_id"),
                Events.name_kh.label("event_name"),
            )
            .join(Athlete, Athlete.enroll_id == Enroll.id)
            .join(AthleteParticipation, Athlete.id == AthleteParticipation.athletes_id)
            .outerjoin(Sport, Sport.id == AthleteParticipation.sports_id)
            .outerjoin(
                Organization, Organization.id == AthleteParticipation.organization_id
            )
            .outerjoin(
                CategoryModel, CategoryModel.id == AthleteParticipation.category_id
            )
            .outerjoin(Events, Events.id == AthleteParticipation.events_id)
        )

    def build_leader_query(self):
        """Build the SELECT + JOIN chain for leaders."""
        return (
            select(
                Enroll.id.label("participant_id"),
                Enroll.kh_family_name,
                Enroll.kh_given_name,
                Enroll.en_family_name,
                Enroll.en_given_name,
                Enroll.gender,
                Enroll.date_of_birth.label("date_of_birth"),
                Enroll.phonenumber,
                Enroll.photo_path.label("photoUrl"),
                Enroll.nationality_document_path.label("nationalityDocumentUrl"),
                Enroll.birth_certificate_path.label("birthCertificateUrl"),
                Enroll.national_id_path.label("nationalIdUrl"),
                Enroll.passport_path.label("passportUrl"),
                Enroll.created_at.label("created_at"),
                Sport.id.label("sport_id"),
                Sport.name_kh.label("sport_name"),
                Organization.id.label("org_id"),
                Organization.name_kh.label("org_name"),
                Leader.LeaderRole.label("leader_role"),
                LeaderParticipation.events_id.label("event_id"),
                Events.name_kh.label("event_name"),
            )
            .join(Leader, Leader.enroll_id == Enroll.id)
            .join(LeaderParticipation, Leader.id == LeaderParticipation.leaders_id)
            .outerjoin(Sport, Sport.id == LeaderParticipation.sports_id)
            .outerjoin(
                Organization, Organization.id == LeaderParticipation.organization_id
            )
            .outerjoin(Events, Events.id == LeaderParticipation.events_id)
        )

    def build_list_query(self, params: ParticipantFilterParams):
        """Build a UNION query + count query for paginated participant listing.

        Returns (paginated_query, count_query). All filtering happens at the
        SQL level. The UNION merges athletes and leaders with a ``role`` tag
        so that LIMIT/OFFSET apply correctly across both types.
        """
        common_cols = [
            Enroll.id.label("participant_id"),
            Enroll.kh_family_name,
            Enroll.kh_given_name,
            Enroll.en_family_name,
            Enroll.en_given_name,
            Enroll.phonenumber,
            Enroll.gender,
            Enroll.date_of_birth,
            Enroll.photo_path.label("photoUrl"),
            Enroll.nationality_document_path.label("nationalityDocumentUrl"),
            Enroll.birth_certificate_path.label("birthCertificateUrl"),
            Enroll.national_id_path.label("nationalIdUrl"),
            Enroll.passport_path.label("passportUrl"),
            Enroll.created_at,
            Sport.id.label("sport_id"),
            Sport.name_kh.label("sport_name"),
            Organization.id.label("org_id"),
            Organization.name_kh.label("org_name"),
            Events.name_kh.label("event_name"),
        ]

        def _apply_filters(q, participation_model):
            if params.event_id is not None:
                q = q.filter(participation_model.events_id == params.event_id)
            if params.sport_id is not None:
                q = q.filter(participation_model.sports_id == params.sport_id)
            if params.organization_id is not None:
                q = q.filter(
                    participation_model.organization_id == params.organization_id
                )
            if params.category_id is not None:
                q = q.filter(participation_model.category_id == params.category_id)
            if params.gender is not None:
                q = q.filter(
                    func.lower(cast(Enroll.gender, Text)) == params.gender.lower()
                )
            if params.search:
                term = f"%{params.search}%"
                q = q.filter(Enroll.search_text.ilike(term))
            return q

        athlete_q = _apply_filters(
            select(
                *common_cols,
                CategoryModel.id.label("category_id"),
                CategoryModel.category.label("category_name"),
                cast(None, String).label("leader_role"),
                literal("athlete").label("role"),
                AthleteParticipation.events_id,
            )
            .join(Athlete, Athlete.enroll_id == Enroll.id)
            .join(AthleteParticipation, Athlete.id == AthleteParticipation.athletes_id)
            .outerjoin(Sport, Sport.id == AthleteParticipation.sports_id)
            .outerjoin(
                Organization, Organization.id == AthleteParticipation.organization_id
            )
            .outerjoin(Events, Events.id == AthleteParticipation.events_id)
            .outerjoin(
                CategoryModel, CategoryModel.id == AthleteParticipation.category_id
            ),
            AthleteParticipation,
        )

        leader_q = _apply_filters(
            select(
                *common_cols,
                # Leaders aren't category-scoped; emit typed NULLs so this branch
                # lines up column-for-column with the athlete branch for UNION.
                cast(None, Integer).label("category_id"),
                cast(None, String).label("category_name"),
                # Cast the enum to text so this branch's leader_role column type
                # matches the athlete branch's CAST(NULL AS VARCHAR); Postgres
                # refuses to UNION the `leader_role` enum with varchar otherwise.
                cast(Leader.LeaderRole, String).label("leader_role"),
                literal("leader").label("role"),
                LeaderParticipation.events_id,
            )
            .join(Leader, Leader.enroll_id == Enroll.id)
            .join(LeaderParticipation, Leader.id == LeaderParticipation.leaders_id)
            .outerjoin(Sport, Sport.id == LeaderParticipation.sports_id)
            .outerjoin(
                Organization, Organization.id == LeaderParticipation.organization_id
            )
            .outerjoin(Events, Events.id == LeaderParticipation.events_id),
            LeaderParticipation,
        )

        if params.leader_roles:
            role_values = [
                r.value if hasattr(r, "value") else str(r).lower()
                for r in params.leader_roles
            ]
            leader_q = leader_q.filter(
                func.lower(cast(Leader.LeaderRole, Text)).in_(role_values)
            )

        role = params.role.lower() if params.role else None
        if role == "athlete":
            union = athlete_q
        elif role == "leader":
            union = leader_q
        else:
            union = union_all(athlete_q, leader_q)

        cte = union.subquery()
        count_query = select(func.count()).select_from(cte)
        return union, count_query

    async def get_owner_org_id(
        self, enroll_id: int, role: str | None = None
    ) -> int | None:
        """
        Return the organization_id that owns a participant record, or None if the
        record does not exist. Used for per-org access control on the by-id
        get/update/delete endpoints (prevents cross-org IDOR).

        When ``role`` is None (e.g. the delete endpoint, which has no role in its
        body), both the athlete and leader participation tables are checked.
        """
        normalized = role.lower() if role else None

        athlete_q = (
            select(AthleteParticipation.organization_id)
            .join(Athlete, Athlete.id == AthleteParticipation.athletes_id)
            .where(Athlete.enroll_id == enroll_id)
        )
        leader_q = (
            select(LeaderParticipation.organization_id)
            .join(Leader, Leader.id == LeaderParticipation.leaders_id)
            .where(Leader.enroll_id == enroll_id)
        )

        if normalized == "athlete":
            queries = [athlete_q]
        elif normalized is not None:
            queries = [leader_q]
        else:
            queries = [athlete_q, leader_q]

        for query in queries:
            result = await self.db.execute(query)
            org_id = result.scalars().first()
            if org_id is not None:
                return org_id
        return None
