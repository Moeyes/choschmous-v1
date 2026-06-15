import logging

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date as date_type

from src.models.enroll import Enroll
from src.models.events import Events
from src.models.organization import Organization
from src.models.organizer_role import OrganizerRole
from src.models.organizer_participation import OrganizerParticipation
from src.models.user import User
from src.schemas.organizer import (
    OrganizerRegistrationRequest,
    OrganizerRoleCreate,
    OrganizerRoleUpdate,
)
from src.services.file_access import assert_can_reference_files

logger = logging.getLogger(__name__)


class OrganizerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _raise(status_code: int, code: str, message: str, **params):
        detail = {"code": code, "message": message}
        if params:
            detail["params"] = params
        raise HTTPException(status_code=status_code, detail=detail)

    async def register_organizer(
        self, data: OrganizerRegistrationRequest, current_user: User
    ) -> dict:
        # Reject managed file references the caller is not authorized to use.
        await assert_can_reference_files(
            self.db,
            current_user,
            [
                data.photoUrl,
                data.nationalityDocumentPath,
                data.birthCertificatePath,
                data.nationalIdPath,
                data.passportPath,
            ],
        )
        event = await self.db.get(Events, data.eventId)
        if not event:
            self._raise(404, "EVENT_NOT_FOUND", "Event not found.")
        if not event.registration_is_open:
            self._raise(403, "REGISTRATION_CLOSED",
                        "Registration is not open for this event.")

        role = await self.db.get(OrganizerRole, data.organizerRoleId)
        if not role:
            self._raise(404, "ROLE_NOT_FOUND", "Organizer role not found.")
        if not role.active:
            self._raise(422, "ROLE_INACTIVE", "This organizer role is not active.")

        if data.organizationId:
            org = await self.db.get(Organization, data.organizationId)
            if not org:
                self._raise(404, "ORG_NOT_FOUND", "Organization not found.")

        gender_upper = data.gender.strip().upper() if data.gender else ""

        from src.models.enum.user import genderEnum, IdDocumentType
        try:
            gender_val = genderEnum(gender_upper)
        except ValueError:
            self._raise(422, "INVALID_GENDER", f"Invalid gender: {data.gender}")

        # Map the frontend's document labels to enum values, matching the
        # athlete/leader path (src/schemas/enroll.py:fit_to_id_doc_enum) so the
        # same UI value ("IDCard") works for organizers too.
        _id_doc_map = {
            "IDCard": "CAM_NID",
            "Passport": "CAM_PASSPORT",
            "BirthCertificate": "CAM_BIRTH_CERT",
            "FamilyBook": "CAM_FAMILY_BOOK",
        }
        raw_doc = _id_doc_map.get(data.idDocType, data.idDocType)
        try:
            id_doc_val = IdDocumentType(raw_doc)
        except ValueError:
            self._raise(422, "INVALID_ID_DOC_TYPE", f"Invalid ID doc type: {data.idDocType}")

        today = date_type.today()
        age = today.year - data.dateOfBirth.year
        if (today.month, today.day) < (data.dateOfBirth.month, data.dateOfBirth.day):
            age -= 1
        if age < 18:
            if not data.birthCertificatePath:
                self._raise(422, "DOCUMENT_REQUIRED",
                            "A birth certificate is required for participants under 18.",
                            requires="birth_certificate", age=age)
        else:
            if not data.nationalIdPath and not data.passportPath:
                self._raise(422, "DOCUMENT_REQUIRED",
                            "A national ID or passport is required for participants 18 and older.",
                            requires="national_id_or_passport", age=age)

        enroll = Enroll(
            kh_family_name=data.lastNameKhmer,
            kh_given_name=data.firstNameKhmer,
            en_family_name=data.lastNameLatin,
            en_given_name=data.firstNameLatin,
            gender=gender_val,
            nationality=data.nationality or "Cambodian",
            date_of_birth=data.dateOfBirth,
            phonenumber=data.phone,
            id_document_type=id_doc_val,
            address=data.address,
            photo_path=data.photoUrl,
            nationality_document_path=data.nationalityDocumentPath,
            birth_certificate_path=data.birthCertificatePath,
            national_id_path=data.nationalIdPath,
            passport_path=data.passportPath,
        )
        self.db.add(enroll)
        await self.db.flush()

        participation = OrganizerParticipation(
            enroll_id=enroll.id,
            event_id=data.eventId,
            organization_id=data.organizationId,
            organizer_role_id=data.organizerRoleId,
        )
        self.db.add(participation)
        await self.db.flush()

        await self.db.commit()
        await self.db.refresh(participation)

        return {
            "enroll_id": enroll.id,
            "organizer_participation_id": participation.id,
            "organizer_role_id": role.id,
            "role_name_en": role.name_en,
            "role_name_kh": role.name_kh,
            "event_id": data.eventId,
            "organization_id": data.organizationId,
            "kh_family_name": enroll.kh_family_name,
            "kh_given_name": enroll.kh_given_name,
            "created_at": participation.created_at,
        }

    async def list_roles(self, active_only: bool = True) -> list[OrganizerRole]:
        query = select(OrganizerRole).order_by(OrganizerRole.id)
        if active_only:
            query = query.where(OrganizerRole.active.is_(True))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_role(self, data: OrganizerRoleCreate) -> OrganizerRole:
        existing = await self.db.execute(
            select(OrganizerRole).where(
                (OrganizerRole.name_en == data.name_en)
                | (OrganizerRole.name_kh == data.name_kh)
            )
        )
        if existing.scalar_one_or_none():
            self._raise(409, "ROLE_EXISTS",
                        "An organizer role with this name already exists.")

        role = OrganizerRole(**data.model_dump())
        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def update_role(self, role_id: int, data: OrganizerRoleUpdate) -> OrganizerRole:
        role = await self.db.get(OrganizerRole, role_id)
        if not role:
            self._raise(404, "ROLE_NOT_FOUND", "Organizer role not found.")

        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(role, field, value)
        await self.db.commit()
        await self.db.refresh(role)
        return role
