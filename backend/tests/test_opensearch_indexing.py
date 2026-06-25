"""CHOS-304: OpenSearch athlete indexing uses the SAME minimized projection as
the DB provider — NAME + organisation + scope ids only, never phone/DOB/ID-doc.

Runs the real ``bulk_reindex`` against the test DB with a fake OpenSearch client
(so opensearch-py is not required) and asserts the indexed athlete document
carries no PII beyond the name.
"""

from datetime import date

from app.infrastructure.search.opensearch_provider import OpenSearchProvider
from src.models.athlete_participation import AthleteParticipation
from src.models.athletes import Athlete
from src.models.enroll import Enroll
from src.models.enum.user import IdDocumentType, genderEnum
from tests.factories import make_org, make_sport


class _FakeIndices:
    async def exists(self, index):
        return True

    async def create(self, index, body):  # pragma: no cover - not hit (exists=True)
        ...


class _FakeClient:
    def __init__(self):
        self.indices = _FakeIndices()
        self.bulk_body = None

    async def bulk(self, body, refresh=False):
        self.bulk_body = body


async def _seed_athlete(db, org, sport, family="សុខ", given="ដារា"):
    enroll = Enroll(
        kh_family_name=family,
        kh_given_name=given,
        en_family_name="Sok",
        en_given_name="Dara",
        phonenumber="012345678",  # PII that must NOT reach the index
        gender=genderEnum.MALE,
        date_of_birth=date(2008, 1, 1),
        id_document_type=IdDocumentType.CAM_NID,
    )
    db.add(enroll)
    await db.flush()
    athlete = Athlete(enroll_id=enroll.id)
    db.add(athlete)
    await db.flush()
    db.add(
        AthleteParticipation(
            athletes_id=athlete.id, organization_id=org.id, sports_id=sport.id
        )
    )
    await db.flush()
    return enroll


async def test_bulk_reindex_athletes_is_minimized_and_pii_free(db_session):
    org = await make_org(db_session, name_kh="សហព័ន្ធ")
    sport = await make_sport(db_session)
    enroll = await _seed_athlete(db_session, org, sport)

    provider = OpenSearchProvider("http://opensearch:9200", "moeys")
    fake = _FakeClient()
    provider._client = fake  # bypass the lazy opensearch-py import

    pairs = await provider.bulk_reindex(db_session)
    assert pairs >= 1

    body = fake.bulk_body
    assert body, "bulk() should have been called with actions"
    docs = body[1::2]  # [index-meta, doc, index-meta, doc, ...]

    athlete_docs = [d for d in docs if d.get("type") == "athlete"]
    assert athlete_docs, "the athlete should have been indexed"
    d = athlete_docs[0]

    # Minimized projection: NAME + org + scope ids, nothing else.
    assert d["entity_id"] == enroll.id
    assert "សុខ" in d["title"] and "ដារា" in d["title"]
    assert d["subtitle"] == "សហព័ន្ធ"
    assert d["org_id"] == org.id and d["sport_id"] == sport.id
    assert set(d) == {"type", "entity_id", "title", "subtitle", "org_id", "sport_id"}

    # No PII may ever appear in the index document or its serialized form.
    forbidden = {
        "phone", "phonenumber", "date_of_birth", "dob",
        "id_document", "id_document_type", "search_text", "gender", "address",
    }
    assert not (set(d) & forbidden)
    assert "012345678" not in str(d)
