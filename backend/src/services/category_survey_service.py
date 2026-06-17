from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete, func

from src.models.category import category
from src.models.category_survey_review import category_survey_review
from src.models.events import Events
from src.models.sport import Sport
from src.schemas.category_survey import CategorySurveyUpsert


class CategoryReviewError(Exception):
    """Raised when an FSM transition is not allowed. ``code`` is the HTTP status.

    Mirrors ``ParticipationReviewError`` (by-number) so by-category reviews share
    the same typed-error -> HTTP mapping at the route."""

    def __init__(self, message: str, code: int = 409):
        super().__init__(message)
        self.code = code


# Allowed review transitions: action -> (valid current states, target state, note required?)
# Identical FSM to ``participation_per_sport_service.REVIEW_TRANSITIONS`` — by
# design (no invented states).
REVIEW_TRANSITIONS: dict[str, tuple[set[str], str, bool]] = {
    "submit": ({"DRAFT", "REVISION_REQUESTED"}, "SUBMITTED", False),
    "approve": ({"SUBMITTED", "FLAGGED", "REVISION_REQUESTED"}, "APPROVED", False),
    "reject": ({"SUBMITTED", "FLAGGED"}, "REJECTED", True),
    "flag": ({"SUBMITTED"}, "FLAGGED", True),
    "request_revision": ({"SUBMITTED", "FLAGGED"}, "REVISION_REQUESTED", True),
}


class CategorySurveyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_event_phase_open(self, event_id: int) -> Events | None:
        """Fetch event; returns None if not found."""
        return await self.db.get(Events, event_id)

    async def upsert_categories(self, payload: CategorySurveyUpsert) -> list[category]:
        event_id = payload.event_id
        sport_id = payload.sport_id

        incoming_names = {c.name for c in payload.categories}

        existing_q = await self.db.execute(
            select(category).where(
                category.events_id == event_id,
                category.sports_id == sport_id,
            )
        )
        existing_rows = existing_q.scalars().all()

        existing_names = {c.category for c in existing_rows}

        names_to_delete = existing_names - incoming_names
        if names_to_delete:
            await self.db.execute(
                sa_delete(category).where(
                    category.events_id == event_id,
                    category.sports_id == sport_id,
                    category.category.in_(names_to_delete),
                )
            )

        for item in payload.categories:
            if item.name in existing_names:
                existing = next(c for c in existing_rows if c.category == item.name)
                if existing.gender != item.gender:
                    existing.gender = item.gender
                    self.db.add(existing)
            else:
                new_cat = category(
                    sports_id=sport_id,
                    category=item.name,
                    gender=item.gender,
                    events_id=event_id,
                )
                self.db.add(new_cat)

        # Ensure a review-state header exists for this (event, sport). This is
        # the "submitted" moment — mirrors by-number, where a submission row
        # carries the review FSM. Created with the default SUBMITTED status; an
        # existing header is left as-is on re-submit (status is NOT reset).
        existing_review = await self.db.execute(
            select(category_survey_review).where(
                category_survey_review.events_id == event_id,
                category_survey_review.sports_id == sport_id,
            )
        )
        if existing_review.scalar_one_or_none() is None:
            self.db.add(category_survey_review(events_id=event_id, sports_id=sport_id))

        await self.db.commit()

        result = await self.db.execute(
            select(category)
            .where(
                category.events_id == event_id,
                category.sports_id == sport_id,
            )
            .order_by(category.id)
        )
        return result.scalars().all()

    async def list_categories(self, event_id: int, sport_id: int) -> list[category]:
        result = await self.db.execute(
            select(category)
            .where(
                category.events_id == event_id,
                category.sports_id == sport_id,
            )
            .order_by(category.id)
        )
        return result.scalars().all()

    # ------------------------------------------------------------------ #
    # Admin review queue (mirrors ParticipationPerSportService list/review)
    # ------------------------------------------------------------------ #

    @staticmethod
    def _category_count_subquery():
        """Correlated COUNT of categories for a review header's (event, sport)."""
        return (
            select(func.count(category.id))
            .where(
                category.events_id == category_survey_review.events_id,
                category.sports_id == category_survey_review.sports_id,
            )
            .correlate(category_survey_review)
            .scalar_subquery()
        )

    async def list_submissions(
        self,
        skip: int = 0,
        limit: int = 100,
        event_id: int | None = None,
        status: str | None = None,
    ) -> list[dict]:
        q = (
            select(
                category_survey_review,
                Events.name_kh.label("event_name"),
                Sport.name_kh.label("sport_name"),
                self._category_count_subquery().label("category_count"),
            )
            .outerjoin(Events, category_survey_review.events_id == Events.id)
            .outerjoin(Sport, category_survey_review.sports_id == Sport.id)
        )
        if event_id is not None:
            q = q.where(category_survey_review.events_id == event_id)
        if status is not None:
            q = q.where(category_survey_review.status == status)
        # Deterministic ordering so OFFSET/LIMIT pages are stable across requests.
        q = q.order_by(category_survey_review.id).offset(skip).limit(limit)
        result = await self.db.execute(q)
        rows = result.mappings().all()
        return [
            {
                **row["category_survey_review"].__dict__,
                "event_name": row["event_name"],
                "sport_name": row["sport_name"],
                "category_count": row["category_count"] or 0,
            }
            for row in rows
        ]

    async def _enrich_submission(
        self, item: category_survey_review, with_categories: bool = False
    ) -> dict:
        """Add event/sport names (+ category count, + the categories themselves)
        to a loaded review header — the by-category analogue of by-number's
        ``_enrich``."""
        result = await self.db.execute(
            select(
                Events.name_kh.label("event_name"),
                Sport.name_kh.label("sport_name"),
            )
            .select_from(category_survey_review)
            .outerjoin(Events, category_survey_review.events_id == Events.id)
            .outerjoin(Sport, category_survey_review.sports_id == Sport.id)
            .where(category_survey_review.id == item.id)
        )
        row = result.mappings().first()

        cats = await self.db.execute(
            select(category)
            .where(
                category.events_id == item.events_id,
                category.sports_id == item.sports_id,
            )
            .order_by(category.id)
        )
        category_rows = cats.scalars().all()

        enriched = {
            **item.__dict__,
            "event_name": row["event_name"] if row else None,
            "sport_name": row["sport_name"] if row else None,
            "category_count": len(category_rows),
        }
        if with_categories:
            enriched["categories"] = category_rows
        return enriched

    async def get_submission(self, id: int) -> dict | None:
        item = await self.db.get(category_survey_review, id)
        if not item:
            return None
        return await self._enrich_submission(item, with_categories=True)

    async def review(
        self, id: int, action: str, note: str | None = None
    ) -> dict | None:
        """Apply an FSM review transition. Returns the enriched submission, or
        None if the id does not exist. Raises CategoryReviewError on an illegal
        transition or a missing required note. Identical semantics to
        ParticipationPerSportService.review."""
        rule = REVIEW_TRANSITIONS.get(action)
        if rule is None:
            raise CategoryReviewError(f"Unknown action '{action}'", code=400)
        allowed_from, target, needs_note = rule

        item = await self.db.get(category_survey_review, id)
        if not item:
            return None

        current = item.status or "SUBMITTED"
        if current not in allowed_from:
            raise CategoryReviewError(
                f"Cannot '{action}' a submission with status '{current}'.",
                code=409,
            )
        if needs_note and not (note and note.strip()):
            raise CategoryReviewError(f"A note is required to '{action}'.", code=400)

        item.status = target
        if note is not None:
            item.review_note = note
        item.reviewed_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(item)
        return await self._enrich_submission(item, with_categories=True)
