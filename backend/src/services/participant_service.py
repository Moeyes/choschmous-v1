import logging

from sqlalchemy import (
    cast,
    delete as sa_delete,
    desc,
    func,
    literal,
    or_,
    select,
    String,
    Text,
    union_all,
    update as sa_update,
)
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

logger = logging.getLogger(__name__)

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
from src.models.enum.user import LeaderRole

from src.schemas.enroll import ParticipantFilterParams, ParticipantUpdateRequest
from src.schemas.registration import FullRegistrationRequest


class ParticipantService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_participant(self, data: FullRegistrationRequest):
        try:
            new_enroll = Enroll(
                user_id=data.userId,
                kh_family_name=data.kh_family_name,
                kh_given_name=data.kh_given_name,
                en_family_name=data.en_family_name,
                en_given_name=data.en_given_name,
                phonenumber=data.phone,
                gender=data.gender,
                date_of_birth=data.date_of_birth,
                id_document_type=data.id_document_type,
                address=data.address,
                photo_path=data.photoUrl,
                nationality_document_path=data.nationalityDocumentUrl,
                birth_certificate_path=data.birthCertificateUrl,
                national_id_path=data.nationalIdUrl,
                passport_path=data.passportUrl,
            )
            self.db.add(new_enroll)
            await self.db.flush()

            if data.role.lower() == "athlete":
                await self._create_athlete(new_enroll.id, data)
            elif data.role.lower() == "leader":
                await self._create_leader(new_enroll.id, data)
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid role. Must be 'athlete' or 'leader'.",
                )

            await self.db.commit()
            return {"status": "success", "enroll_id": new_enroll.id}

        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error("Registration failed", exc_info=True)
            raise HTTPException(
                status_code=500, detail="Registration failed due to a server error"
            )

    async def _create_athlete(self, enroll_id: int, data: FullRegistrationRequest):
        athlete = Athlete(enroll_id=enroll_id)
        self.db.add(athlete)
        await self.db.flush()

        participation = AthleteParticipation(
            athletes_id=athlete.id,
            events_id=data.eventId,
            sports_id=data.sportId,
            category_id=data.categoryId,
            organization_id=data.organizationId,
        )
        self.db.add(participation)

    async def _create_leader(self, enroll_id: int, data: FullRegistrationRequest):
        leader = Leader(enroll_id=enroll_id, LeaderRole=data.leaderRole)
        self.db.add(leader)
        await self.db.flush()

        participation = LeaderParticipation(
            leaders_id=leader.id,
            events_id=data.eventId,
            sports_id=data.sportId,
            organization_id=data.organizationId,
        )
        self.db.add(participation)

    def _filtered_query(self, params: ParticipantFilterParams, role: str):
        """Build the role's base query with all common filters applied (no
        pagination). ``role`` is 'athlete' or 'leader'."""
        if role == "athlete":
            query = self._build_athlete_query()
            participation_model = AthleteParticipation
        else:
            query = self._build_leader_query()
            participation_model = LeaderParticipation
            if params.leader_roles:
                role_values = [
                    r.value if hasattr(r, "value") else str(r).lower()
                    for r in params.leader_roles
                ]
                query = query.filter(
                    func.lower(cast(Leader.LeaderRole, Text)).in_(role_values)
                )

        if params.event_id is not None:
            query = query.filter(participation_model.events_id == params.event_id)

        if params.sport_id is not None:
            query = query.filter(participation_model.sports_id == params.sport_id)

        if params.organization_id is not None:
            query = query.filter(
                participation_model.organization_id == params.organization_id
            )

        if params.search:
            term = f"%{params.search}%"
            query = query.filter(Enroll.search_text.ilike(term))
        return query

    async def get_participants(self, params: ParticipantFilterParams):
        query, count_query = self._build_list_query(params)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        page_query = query.order_by(desc("created_at"))
        page_query = page_query.limit(params.limit).offset(params.offset)
        result = await self.db.execute(page_query)
        rows = [self._format_list_row(r, r["role"]) for r in result.mappings().all()]

        limit = params.limit or 20
        total_pages = max(1, (total + limit - 1) // limit) if limit > 0 else 1
        current_page = (params.offset // limit) + 1 if limit > 0 else 1

        return {
            "status": "success",
            "data": rows,
            "count": total,
            "total_pages": total_pages,
            "has_next": current_page < total_pages,
            "has_prev": current_page > 1,
            "page": current_page,
            "page_size": limit,
        }

    def _build_list_query(self, params: ParticipantFilterParams):
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
                q = q.filter(participation_model.organization_id == params.organization_id)
            if params.search:
                term = f"%{params.search}%"
                q = q.filter(Enroll.search_text.ilike(term))
            return q

        athlete_q = _apply_filters(
            select(
                *common_cols,
                cast(None, String).label("leader_role"),
                literal("athlete").label("role"),
                AthleteParticipation.events_id,
            )
            .join(Athlete, Athlete.enroll_id == Enroll.id)
            .join(AthleteParticipation, Athlete.id == AthleteParticipation.athletes_id)
            .outerjoin(Sport, Sport.id == AthleteParticipation.sports_id)
            .outerjoin(Organization, Organization.id == AthleteParticipation.organization_id)
            .outerjoin(Events, Events.id == AthleteParticipation.events_id),
            AthleteParticipation,
        )

        leader_q = _apply_filters(
            select(
                *common_cols,
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
            .outerjoin(Organization, Organization.id == LeaderParticipation.organization_id)
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

    async def get_participant_by_id(self, enroll_id: int, role: str):
        """Fetch a single participant by enroll_id with full nested data."""
        role = role.lower()

        if role == "athlete":
            query = self._build_athlete_query().filter(Enroll.id == enroll_id)
        else:
            query = self._build_leader_query().filter(Enroll.id == enroll_id)

        result = await self.db.execute(query)
        row = result.mappings().first()

        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Participant with enroll_id={enroll_id} not found.",
            )

        return {"status": "success", "data": self._format_row(row, role)}

    async def get_participant_phone(self, enroll_id: int) -> str:
        """Return a single participant's phone number for an audited reveal.

        Kept deliberately narrow: callers (the reveal endpoint) request exactly
        one Restricted-PII field, which is what gets recorded in the audit log.
        """
        result = await self.db.execute(
            select(Enroll.phonenumber).where(Enroll.id == enroll_id)
        )
        phone = result.scalar_one_or_none()
        if phone is None:
            raise HTTPException(
                status_code=404,
                detail=f"Participant with enroll_id={enroll_id} not found.",
            )
        return phone

    async def update_participant(
        self, enroll_id: int, role: str, data: ParticipantUpdateRequest
    ):
        """Update Enroll personal info and participation data atomically."""
        role = role.lower()

        try:
            enroll = await self.db.get(Enroll, enroll_id)
            if not enroll:
                raise HTTPException(
                    status_code=404,
                    detail=f"Enroll record with id={enroll_id} not found.",
                )

            personal_fields = {
                "kh_family_name": data.kh_family_name,
                "kh_given_name": data.kh_given_name,
                "en_family_name": data.en_family_name,
                "en_given_name": data.en_given_name,
                "phonenumber": data.phone,
                "gender": data.gender,
                "date_of_birth": data.date_of_birth,
                "address": data.address,
                "photo_path": data.photoUrl,
                "nationality_document_path": data.nationalityDocumentUrl,
                "birth_certificate_path": data.birthCertificateUrl,
                "national_id_path": data.nationalIdUrl,
                "passport_path": data.passportUrl,
            }
            for field, value in personal_fields.items():
                if value is not None:
                    setattr(enroll, field, value)

            if role == "athlete":
                await self._update_athlete_participation(enroll_id, data)
            else:
                await self._update_leader_participation(enroll_id, data)

            await self.db.commit()

            return await self.get_participant_by_id(enroll_id, role)

        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error("Participant update failed", exc_info=True)
            raise HTTPException(status_code=500, detail="Update failed due to a server error")

    async def _update_athlete_participation(
        self, enroll_id: int, data: ParticipantUpdateRequest
    ):
        """Update the athlete's participation record."""
        result = await self.db.execute(
            select(Athlete).where(Athlete.enroll_id == enroll_id)
        )
        athlete = result.scalars().first()
        if not athlete:
            raise HTTPException(
                status_code=404, detail="Athlete record not found for this enrollment."
            )

        result = await self.db.execute(
            select(AthleteParticipation).where(
                AthleteParticipation.athletes_id == athlete.id
            )
        )
        participation = result.scalars().first()
        if not participation:
            raise HTTPException(
                status_code=404, detail="Athlete participation record not found."
            )

        if data.sport_id is not None:
            participation.sports_id = data.sport_id
        if data.organization_id is not None:
            participation.organization_id = data.organization_id
        if data.category_id is not None:
            participation.category_id = data.category_id

    async def _update_leader_participation(
        self, enroll_id: int, data: ParticipantUpdateRequest
    ):
        """Update the leader's role and participation record."""
        result = await self.db.execute(
            select(Leader).where(Leader.enroll_id == enroll_id)
        )
        leader = result.scalars().first()
        if not leader:
            raise HTTPException(
                status_code=404, detail="Leader record not found for this enrollment."
            )

        if data.leader_role is not None:
            leader.LeaderRole = data.leader_role

        result = await self.db.execute(
            select(LeaderParticipation).where(
                LeaderParticipation.leaders_id == leader.id
            )
        )
        participation = result.scalars().first()
        if not participation:
            raise HTTPException(
                status_code=404, detail="Leader participation record not found."
            )

        if data.sport_id is not None:
            participation.sports_id = data.sport_id
        if data.organization_id is not None:
            participation.organization_id = data.organization_id

    async def delete_participant(self, enroll_id: int):
        """
        Delete a participant by enroll_id.
        Cascades to athlete/leader records. Leader participations are
        explicitly cleaned up since their FK uses SET NULL.
        """
        try:
            enroll = await self.db.get(Enroll, enroll_id)
            if not enroll:
                raise HTTPException(
                    status_code=404,
                    detail=f"Participant with enroll_id={enroll_id} not found.",
                )

            # Delete related Athlete(s) if any
            athlete_result = await self.db.execute(
                select(Athlete).where(Athlete.enroll_id == enroll_id)
            )
            athletes_to_delete = athlete_result.scalars().all()
            for athlete in athletes_to_delete:
                await self.db.delete(athlete)
            await self.db.flush()

            # Delete related LeaderParticipation(s) if any
            leader_result = await self.db.execute(
                select(Leader.id).where(Leader.enroll_id == enroll_id)
            )
            leader_id = leader_result.scalar()
            if leader_id:
                await self.db.execute(
                    sa_delete(LeaderParticipation).where(
                        LeaderParticipation.leaders_id == leader_id
                    )
                )

            # Delete related Leader if any
            leader_obj_result = await self.db.execute(
                select(Leader).where(Leader.enroll_id == enroll_id)
            )
            leader_obj = leader_obj_result.scalars().first()
            if leader_obj:
                await self.db.delete(leader_obj)
            await self.db.flush()

            await self.db.delete(enroll)
            await self.db.commit()

            return {"status": "success", "detail": f"Participant {enroll_id} deleted."}

        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error("Participant delete failed", exc_info=True)
            raise HTTPException(status_code=500, detail="Delete failed due to a server error")

    def _build_athlete_query(self):
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

    def _build_leader_query(self):
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

    def _format_row(self, r: dict, role: str) -> dict:
        """Transform a raw DB row mapping into a standardized response dict."""
        created_at = r.get("created_at")
        result = {
            "participant_id": r["participant_id"],
            # Flat aliases consumed by the registrations list table.
            "id": r["participant_id"],
            "created_at": created_at.isoformat() if created_at is not None else None,
            "photo_url": r.get("photoUrl"),
            "sport_name": r.get("sport_name"),
            "event_name": r.get("event_name"),
            "kh_family_name": r["kh_family_name"],
            "kh_given_name": r["kh_given_name"],
            "en_family_name": r["en_family_name"],
            "en_given_name": r["en_given_name"],
            "name_kh": f"{r['kh_family_name']} {r['kh_given_name']}",
            "name_en": f"{r['en_family_name']} {r['en_given_name']}",
            "gender": (
                r["gender"].value.title()
                if hasattr(r["gender"], "value")
                else str(r["gender"]).title()
            ),
            "phone": r["phonenumber"],
            "date_of_birth": (
                r["date_of_birth"].isoformat()
                if r.get("date_of_birth") is not None
                else None
            ),
            "photoUrl": r.get("photoUrl"),
            "nationalityDocumentUrl": r.get("nationalityDocumentUrl"),
            "birthCertificateUrl": r.get("birthCertificateUrl"),
            "nationalIdUrl": r.get("nationalIdUrl"),
            "passportUrl": r.get("passportUrl"),
            "role": role,
            "sport": (
                {"id": r["sport_id"], "name": r["sport_name"]}
                if r.get("sport_id")
                else None
            ),
            "organization": (
                {"id": r["org_id"], "name": r["org_name"]} if r.get("org_id") else None
            ),
            "event_id": r.get("event_id"),
        }

        if role == "athlete":
            result["category"] = (
                {"id": r["category_id"], "name": r["category_name"]}
                if r.get("category_id")
                else None
            )
        else:
            leader_role = r.get("leader_role")
            result["leader_role"] = (
                leader_role.value if hasattr(leader_role, "value") else leader_role
            )

        return result

    def _format_list_row(self, r: dict, role: str) -> dict:
        """Lean projection for the registrations LIST/SEARCH view.

        Data minimization (data-governance §2): the list table only needs names,
        photo, sport/event labels and role, so Restricted-PII (phone, DOB,
        national-ID / passport / birth-certificate URLs, gender, address) never
        leaves the server for this view. Full data is served only by the
        single-record detail endpoint via ``_format_row``. Every key here is a
        subset of the columns ``_format_row`` already reads.
        """
        created_at = r.get("created_at")
        leader_role = r.get("leader_role")
        return {
            "id": r["participant_id"],
            "created_at": created_at.isoformat() if created_at is not None else None,
            "kh_family_name": r["kh_family_name"],
            "kh_given_name": r["kh_given_name"],
            "en_family_name": r["en_family_name"],
            "en_given_name": r["en_given_name"],
            "photo_url": r.get("photoUrl"),
            "sport_name": r.get("sport_name"),
            "event_name": r.get("event_name"),
            "role": role,
            "leader_role": (
                None
                if role == "athlete"
                else (leader_role.value if hasattr(leader_role, "value") else leader_role)
            ),
        }
