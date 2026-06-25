"""review-count: GET /dashboard/review-pending-count aggregates the by-number +
by-category submissions awaiting admin review, and is 0 for non-reviewers.
"""

from src.models.category_survey_review import CategorySurveyReview
from src.models.enum.user import UserRole
from src.models.participation_per_sport import ParticipationPerSport
from tests.conftest import make_user


async def _seed_pending(db):
    # 2 by-number (one already approved → not counted) + 1 by-category pending.
    db.add(ParticipationPerSport(status="SUBMITTED"))
    db.add(ParticipationPerSport(status="SUBMITTED"))
    db.add(ParticipationPerSport(status="APPROVED"))
    db.add(CategorySurveyReview(status="SUBMITTED"))
    db.add(CategorySurveyReview(status="REJECTED"))
    await db.commit()


async def test_pending_count_for_admin(client, db_session, as_user):
    await _seed_pending(db_session)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.get("/api/v1/dashboard/review-pending-count")
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data == {"pending": 3, "byNumber": 2, "byCategory": 1}


async def test_pending_count_zero_for_non_reviewer(client, db_session, as_user):
    await _seed_pending(db_session)
    as_user(make_user(UserRole.ORGANIZATION))

    resp = await client.get("/api/v1/dashboard/review-pending-count")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == {"pending": 0, "byNumber": 0, "byCategory": 0}
