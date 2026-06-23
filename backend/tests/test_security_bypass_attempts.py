"""Adversarial verification (fresh audit) — actively try to bypass each control.

Trust nothing from prior passes: every test here attempts a real bypass and only
"passes" if the control holds. Known residual gaps are encoded as xfail so they
are tracked and will flip to xpass when fixed.
"""

import types
import uuid
from datetime import date

import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError

from core import ratelimit
from core.ratelimit import RateLimiter
from src.api.v1.routes import reports as reports_route
from src.models.athlete_participation import (
    athlete_participation as AthleteParticipation,
)
from src.models.athletes import athletes as Athlete
from src.models.enroll import Enroll
from src.models.enum.user import IdDocumentType, UserRole, genderEnum
from src.models.uploaded_file import UploadedFile
from src.models.user import User
from src.services.file_access import user_can_access_file
from weasyprint.urls import URLFetcherResponse

from src.services.report_renderers import (
    ReportAssetBlocked,
    _FONT_URL,
    secure_url_fetcher,
)
from tests.factories import make_org, make_sport

_REAL_CHECK = RateLimiter.check  # captured before conftest's autouse no-op patch
_ID_DOC = list(IdDocumentType)[0]


# ════════════════════════════════════════════════════════════════════════
# 1. SSRF — try to bypass the WeasyPrint url_fetcher allowlist
# ════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "url",
    [
        "FILE:///etc/passwd",  # uppercase scheme
        "file:/etc/passwd",  # single-slash form
        "file:////etc/passwd",  # extra slashes
        "fIlE:///etc/shadow",  # mixed case
        "http://0x7f000001/",  # hex-encoded 127.0.0.1
        "http://2130706433/",  # decimal-encoded 127.0.0.1
        "http://017700000001/",  # octal-encoded
        "http://127.0.0.1.nip.io/",  # public name resolving to loopback
        "http://[::ffff:169.254.169.254]/",  # ipv6-mapped metadata IP
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "http://10.1.2.3/",
        "http://192.168.0.1/",
        "http://172.16.5.5/",
        "http://localhost/",
        "https://metadata.google.internal/",
        "http://example.com/track.png",  # public host: still denied (no remote)
        "//evil.example/x",  # scheme-relative
        "jar:file:///etc/passwd",  # nested scheme
        "ftp://evil/x",
        "gopher://evil/x",
    ],
)
def test_ssrf_fetcher_blocks_every_evasion(url):
    with pytest.raises(ReportAssetBlocked):
        secure_url_fetcher(url)


def test_ssrf_fetcher_allows_only_font_and_data():
    assert isinstance(secure_url_fetcher(_FONT_URL), URLFetcherResponse)
    assert isinstance(
        secure_url_fetcher("data:text/plain;base64,QQ=="), URLFetcherResponse
    )


def test_weasyprint_actually_routes_resources_through_fetcher():
    """Prove the fetcher is invoked for a real <img> (not just escaped away) and
    that blocking it prevents the outbound request."""
    from weasyprint import HTML

    seen, blocked = [], []

    def spy(u):
        seen.append(u)
        try:
            return secure_url_fetcher(u)
        except ReportAssetBlocked:
            blocked.append(u)
            raise

    HTML(
        string='<img src="http://169.254.169.254/latest/meta-data/">',
        url_fetcher=spy,
    ).write_pdf()

    assert "http://169.254.169.254/latest/meta-data/" in seen  # routed through fetcher
    assert "http://169.254.169.254/latest/meta-data/" in blocked  # and blocked


# ════════════════════════════════════════════════════════════════════════
# 2. File authorization — try to bypass object-level access control
# ════════════════════════════════════════════════════════════════════════


async def _make_file(db, uploader_id):
    f = UploadedFile(
        content_type="image/png", size=3, data=b"abc", uploaded_by=uploader_id
    )
    db.add(f)
    await db.flush()
    return f


async def _make_enroll_referencing(db, file_id, *, org_id, sport_id):
    enroll = Enroll(
        kh_family_name="ស",
        kh_given_name="ដ",
        en_family_name="S",
        en_given_name="D",
        phonenumber="012345678",
        gender=genderEnum.MALE,
        date_of_birth=date(2000, 1, 1),
        id_document_type=_ID_DOC,
        national_id_path=f"/api/files/{file_id}",
    )
    db.add(enroll)
    await db.flush()
    ath = Athlete(enroll_id=enroll.id)
    db.add(ath)
    await db.flush()
    ap = AthleteParticipation(
        athletes_id=ath.id, organization_id=org_id, sports_id=sport_id
    )
    db.add(ap)
    await db.flush()
    return enroll


def _user(role, *, uid=None, org_id=None, sport_id=None):
    return User(
        id=uid or uuid.uuid4(), role=role, organization_id=org_id, sport_id=sport_id
    )


@pytest.mark.asyncio
async def test_cross_org_unreferenced_file_denied(db_session):
    """Baseline control: a file with no in-scope reference is denied to other orgs."""
    org_a = await make_org(db_session)
    org_b = await make_org(db_session)
    sport = await make_sport(db_session)
    f = await _make_file(db_session, uuid.uuid4())
    await _make_enroll_referencing(db_session, f.id, org_id=org_a.id, sport_id=sport.id)
    attacker = _user(UserRole.ORGANIZATION, org_id=org_b.id)
    assert await user_can_access_file(db_session, attacker, f) is False


@pytest.mark.asyncio
async def test_self_reference_bypass_is_denied(db_session):
    """FIXED: authorization is ownership-based, so forging an enrollment that
    references a victim's file no longer grants access. Even WITH the malicious
    self-reference present, the attacker is denied because the file's uploader is
    in the victim's org, not the attacker's."""
    org_victim = await make_org(db_session)
    org_attacker = await make_org(db_session)
    sport = await make_sport(db_session)

    # Victim's file, uploaded by a real victim-org user (persisted so its org resolves).
    victim = User(
        kh_family_name="v",
        kh_given_name="v",
        en_family_name="v",
        en_given_name="v",
        email=f"{uuid.uuid4().hex}@t.local",
        username=uuid.uuid4().hex[:14],
        hashed_password="x",
        role=UserRole.ORGANIZATION,
        organization_id=org_victim.id,
    )
    db_session.add(victim)
    await db_session.flush()
    f = await _make_file(db_session, victim.id)

    # Attacker forges an enrollment in THEIR org referencing the victim's file.
    await _make_enroll_referencing(
        db_session, f.id, org_id=org_attacker.id, sport_id=sport.id
    )
    attacker = _user(UserRole.ORGANIZATION, org_id=org_attacker.id)

    # The self-reference is ignored — denied.
    assert await user_can_access_file(db_session, attacker, f) is False


# ════════════════════════════════════════════════════════════════════════
# 3. Redis fallback — try to break graceful degradation
# ════════════════════════════════════════════════════════════════════════


@pytest.fixture
def real_rate_limiter(monkeypatch):
    monkeypatch.setattr(RateLimiter, "check", _REAL_CHECK)


def _req(ip="203.0.113.9"):
    return types.SimpleNamespace(client=types.SimpleNamespace(host=ip))


class _PipelineRaisesRedis:
    """Redis whose pipeline() itself raises (failure before execute())."""

    def pipeline(self):
        raise RedisConnectionError("down at pipeline()")


@pytest.mark.asyncio
async def test_fallback_when_pipeline_creation_raises(monkeypatch, real_rate_limiter):
    async def _get():
        return _PipelineRaisesRedis()

    monkeypatch.setattr(ratelimit, "get_redis", _get)
    lim = RateLimiter(max_requests=2, window_seconds=60, prefix="rl:adv:pipe")
    await lim.check(_req())
    await lim.check(_req())
    with pytest.raises(HTTPException) as e:  # memory fallback still enforces
        await lim.check(_req())
    assert e.value.status_code == 429


@pytest.mark.asyncio
async def test_fallback_when_get_redis_itself_raises(monkeypatch, real_rate_limiter):
    async def _get():
        raise RedisConnectionError("down at connect")

    monkeypatch.setattr(ratelimit, "get_redis", _get)
    lim = RateLimiter(max_requests=5, window_seconds=60, prefix="rl:adv:conn")
    limit, _, _ = await lim.check(_req("198.51.100.9"))  # must NOT raise / 500
    assert limit == 5


# ════════════════════════════════════════════════════════════════════════
# 4. Report throttling + render isolation — try to exhaust workers
# ════════════════════════════════════════════════════════════════════════


def test_report_limiter_is_tight():
    assert reports_route.report_limiter.max_requests <= 10


@pytest.mark.asyncio
async def test_report_limiter_enforces_after_quota(monkeypatch, real_rate_limiter):
    async def _none():
        return None  # force in-memory path

    monkeypatch.setattr(ratelimit, "get_redis", _none)
    lim = reports_route.report_limiter
    req = _req("203.0.113.50")
    raised = False
    for _ in range(lim.max_requests + 2):
        try:
            await lim.check(req, key_suffix="user-x")
        except HTTPException as e:
            raised = e.status_code == 429
    assert raised


@pytest.mark.asyncio
async def test_render_offload_times_out(monkeypatch):
    """A slow render is time-boxed to a 503 instead of blocking forever."""
    monkeypatch.setattr(reports_route, "_RENDER_TIMEOUT_SECONDS", 0.1)

    def slow_render(*_a):
        import time

        time.sleep(1.0)
        return b"never"

    with pytest.raises(HTTPException) as e:
        await reports_route._render_offloaded(slow_render, "x")
    assert e.value.status_code == 503
