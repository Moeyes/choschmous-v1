from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.events import Events
from src.models.organization import Organization
from src.models.open_survey import OpenSurveyField, OpenSurveyResponse
from src.schemas.open_survey import (
    OpenSurveyFieldCreate,
    OpenSurveyFieldUpdate,
    OpenSurveyBulkFieldsCreate,
    OpenSurveyResponseUpsert,
    OpenSurveyResponseWithField,
    OpenSurveyOrgStatus,
)


class OpenSurveyError(Exception):
    """Raised on a bad open-survey request. ``code`` is the HTTP status."""

    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.code = code


class OpenSurveyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_event(self, event_id: int) -> Events | None:
        """Fetch event for the phase gate; returns None if not found.
        Mirrors CategorySurveyService.check_event_phase_open."""
        return await self.db.get(Events, event_id)

    # ---- Field management (admin) -------------------------------------
    async def list_fields(
        self, event_id: int, include_inactive: bool = False
    ) -> list[OpenSurveyField]:
        q = select(OpenSurveyField).where(OpenSurveyField.event_id == event_id)
        if not include_inactive:
            q = q.where(OpenSurveyField.active.is_(True))
        q = q.order_by(OpenSurveyField.sort_order, OpenSurveyField.id)
        result = await self.db.execute(q)
        return result.scalars().all()

    async def create_field(
        self, event_id: int, obj_in: OpenSurveyFieldCreate
    ) -> OpenSurveyField:
        field = OpenSurveyField(event_id=event_id, **obj_in.model_dump())
        self.db.add(field)
        await self.db.commit()
        await self.db.refresh(field)
        return field

    async def bulk_create_fields(
        self, payload: OpenSurveyBulkFieldsCreate
    ) -> list[OpenSurveyField]:
        fields = [
            OpenSurveyField(event_id=payload.event_id, **f.model_dump())
            for f in payload.fields
        ]
        self.db.add_all(fields)
        await self.db.commit()
        for f in fields:
            await self.db.refresh(f)
        return fields

    async def update_field(
        self, field_id: int, obj_in: OpenSurveyFieldUpdate
    ) -> OpenSurveyField | None:
        field = await self.db.get(OpenSurveyField, field_id)
        if not field:
            return None
        for key, value in obj_in.model_dump(exclude_unset=True).items():
            setattr(field, key, value)
        await self.db.commit()
        await self.db.refresh(field)
        return field

    async def deactivate_field(self, field_id: int) -> OpenSurveyField | None:
        """Soft-delete: flip ``active`` to False so existing responses are kept
        but the field stops counting toward completion / new submissions."""
        field = await self.db.get(OpenSurveyField, field_id)
        if not field:
            return None
        field.active = False
        await self.db.commit()
        await self.db.refresh(field)
        return field

    # ---- Org responses (org fills values) -----------------------------
    async def upsert_responses(
        self, event_id: int, organization_id: int, payload: OpenSurveyResponseUpsert
    ) -> list[OpenSurveyResponse]:
        """Upsert one row per (field_id, organization_id). Field ids are checked
        against the event's active fields first so an org cannot write to a field
        belonging to another event (IDOR guard)."""
        active = await self.list_fields(event_id, include_inactive=False)
        active_ids = {f.id for f in active}

        unknown = set(payload.responses) - active_ids
        if unknown:
            raise OpenSurveyError(
                f"Unknown or inactive field id(s) for this event: "
                f"{sorted(unknown)}",
                code=400,
            )

        if not payload.responses:
            return []

        existing_q = await self.db.execute(
            select(OpenSurveyResponse).where(
                OpenSurveyResponse.organization_id == organization_id,
                OpenSurveyResponse.field_id.in_(payload.responses.keys()),
            )
        )
        existing_by_field = {r.field_id: r for r in existing_q.scalars().all()}

        for field_id, value in payload.responses.items():
            row = existing_by_field.get(field_id)
            if row:
                row.value = value
            else:
                self.db.add(
                    OpenSurveyResponse(
                        field_id=field_id,
                        organization_id=organization_id,
                        value=value,
                    )
                )
        await self.db.commit()

        refreshed = await self.db.execute(
            select(OpenSurveyResponse)
            .where(
                OpenSurveyResponse.organization_id == organization_id,
                OpenSurveyResponse.field_id.in_(active_ids),
            )
            .order_by(OpenSurveyResponse.field_id)
        )
        return refreshed.scalars().all()

    async def get_org_fill_view(
        self, event_id: int, organization_id: int
    ) -> list[OpenSurveyResponseWithField]:
        """Org-facing read: every ACTIVE field for the event (ordered by
        sort_order, id) merged with this org's current answer. Fields the org has
        not answered come back with ``value=None`` (id=0 / no response timestamps,
        since no response row exists yet). Not phase-gated — an org may review its
        own answers after the phase closes."""
        fields = await self.list_fields(event_id, include_inactive=False)

        responses_q = await self.db.execute(
            select(OpenSurveyResponse).where(
                OpenSurveyResponse.organization_id == organization_id,
                OpenSurveyResponse.field_id.in_([f.id for f in fields]),
            )
        )
        by_field = {r.field_id: r for r in responses_q.scalars().all()}

        view: list[OpenSurveyResponseWithField] = []
        for field in fields:
            row = by_field.get(field.id)
            view.append(
                OpenSurveyResponseWithField(
                    id=row.id if row else 0,
                    field_id=field.id,
                    organization_id=organization_id,
                    value=row.value if row else None,
                    created_at=row.created_at if row else field.created_at,
                    updated_at=row.updated_at if row else None,
                    label_kh=field.label_kh,
                    label_en=field.label_en,
                    field_type=field.field_type,
                    options=field.options,
                    required=field.required,
                    sort_order=field.sort_order,
                )
            )
        return view

    # ---- Completion overview (admin) ----------------------------------
    async def org_status_overview(self, event_id: int) -> list[OpenSurveyOrgStatus]:
        """Per-organization completion for an event.

        ``total_fields`` / ``answered_fields`` count all active fields (display).
        ``completed`` is based on REQUIRED active fields only: an org is complete
        once every required field has a non-empty answer — optional fields never
        block completion."""
        total_fields = await self.db.scalar(
            select(func.count())
            .select_from(OpenSurveyField)
            .where(
                OpenSurveyField.event_id == event_id,
                OpenSurveyField.active.is_(True),
            )
        )
        total_fields = total_fields or 0

        required_total = await self.db.scalar(
            select(func.count())
            .select_from(OpenSurveyField)
            .where(
                OpenSurveyField.event_id == event_id,
                OpenSurveyField.active.is_(True),
                OpenSurveyField.required.is_(True),
            )
        )
        required_total = required_total or 0

        # Non-empty answers per org, split by all-active (display) vs
        # required-only (drives the completed flag).
        answered_q = await self.db.execute(
            select(
                OpenSurveyResponse.organization_id,
                func.count().label("answered"),
                func.count()
                .filter(OpenSurveyField.required.is_(True))
                .label("required_answered"),
            )
            .join(
                OpenSurveyField,
                OpenSurveyResponse.field_id == OpenSurveyField.id,
            )
            .where(
                OpenSurveyField.event_id == event_id,
                OpenSurveyField.active.is_(True),
                OpenSurveyResponse.value.isnot(None),
                func.trim(OpenSurveyResponse.value) != "",
            )
            .group_by(OpenSurveyResponse.organization_id)
        )
        answered_by_org = {
            row.organization_id: (row.answered, row.required_answered)
            for row in answered_q
        }

        orgs_q = await self.db.execute(
            select(Organization).order_by(Organization.id)
        )
        orgs = orgs_q.scalars().all()

        overview: list[OpenSurveyOrgStatus] = []
        for org in orgs:
            answered, required_answered = answered_by_org.get(org.id, (0, 0))
            overview.append(
                OpenSurveyOrgStatus(
                    org_id=org.id,
                    org_name_kh=org.name_kh,
                    org_name_en=org.name_en,
                    total_fields=total_fields,
                    answered_fields=answered,
                    completed=required_answered >= required_total,
                )
            )
        return overview
