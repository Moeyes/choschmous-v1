"""Breached-password screening tests (CHOS-505, HaveIBeenPwned k-anonymity).

Proves: the pure suffix matcher reads HIBP range responses correctly (incl.
Add-Padding decoy lines); screening is a no-op while disabled (offline/CI safe);
when enabled it rejects a breached password and accepts a clean one; and it
FAILS OPEN when HIBP is unreachable so an outage never blocks registration.
"""

import hashlib

import httpx
import pytest

from core.config import settings
from core.security import _password_breach_count, screen_breached_password


def _range_body_for(password: str, count: int) -> str:
    """Build a realistic /range/<prefix> body that contains ``password``."""
    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    suffix = digest[5:]
    # A couple of unrelated lines + the matching one (order/case shouldn't matter).
    return f"0000000000000000000000000000000000A:3\n{suffix.lower()}:{count}\nFFFFF:0\n"


# ── pure matcher ─────────────────────────────────────────────────────────────
def test_breach_count_finds_suffix_case_insensitive():
    assert _password_breach_count("hunter2breach!", _range_body_for("hunter2breach!", 42)) == 42


def test_breach_count_zero_when_absent():
    body = "0000000000000000000000000000000000A:3\nFFFFF:0\n"
    assert _password_breach_count("totally-unique-xyz-123", body) == 0


def test_breach_count_ignores_padding_zero_count_lines():
    # A decoy line whose count is 0 (Add-Padding) must not be treated as a hit.
    body = _range_body_for("padded-pw-987654", 0)
    assert _password_breach_count("padded-pw-987654", body) == 0


# ── async screening ──────────────────────────────────────────────────────────
async def test_screening_noop_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_ENABLED", False)
    # Even a famously-breached password passes when the feature is off.
    await screen_breached_password("password")  # must not raise


async def test_screening_rejects_breached_password(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_ENABLED", True)
    pw = "BreachedPass123"

    def handler(request: httpx.Request) -> httpx.Response:
        # Endpoint must be /range/<5-hex-prefix>.
        prefix = request.url.path.rsplit("/", 1)[-1]
        assert len(prefix) == 5
        return httpx.Response(200, text=_range_body_for(pw, 1500))

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    with pytest.raises(ValueError, match="data breach"):
        await screen_breached_password(pw, client=client)
    await client.aclose()


async def test_screening_accepts_clean_password(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_ENABLED", True)

    def handler(request: httpx.Request) -> httpx.Response:
        # Return a range that does NOT contain our password's suffix.
        return httpx.Response(200, text="ABCDE:9\n12345:4\n")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    await screen_breached_password("a-clean-unique-pw-007", client=client)  # no raise
    await client.aclose()


async def test_screening_fails_open_on_network_error(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_ENABLED", True)

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("HIBP unreachable")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    # Outage must not raise — registration stays available.
    await screen_breached_password("password", client=client)
    await client.aclose()


async def test_screening_respects_max_breach_count(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_ENABLED", True)
    monkeypatch.setattr(settings, "HIBP_MAX_BREACH_COUNT", 5)
    pw = "SeenButRare42"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=_range_body_for(pw, 3))  # 3 <= 5 → allowed

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    await screen_breached_password(pw, client=client)  # no raise (under threshold)
    await client.aclose()
