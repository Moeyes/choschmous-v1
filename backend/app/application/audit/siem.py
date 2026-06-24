"""Ship audit events to the SIEM (CHOS-403).

Every append to the hash-chained audit log is mirrored to the SIEM so the
security team has an independent, off-box copy (a local DB compromise cannot also
silently rewrite the SIEM's record). Shipping is best-effort and MUST NOT block
or fail the audited business transaction — a SIEM outage degrades to a logged
warning, never a 500.

Disabled by default (local/CI). When ``AUDIT_SIEM_ENABLED`` + ``AUDIT_SIEM_ENDPOINT``
are configured, events are POSTed as JSON with a bearer token.

TODO(infra/CHOS-403): provision the SIEM HTTP collector (e.g. Splunk HEC / Elastic
/ a syslog-over-HTTP gateway) and inject AUDIT_SIEM_ENDPOINT + AUDIT_SIEM_TOKEN
from Vault. Consider buffering/async delivery if event volume is high.
"""

from __future__ import annotations

import logging

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


def _enabled() -> bool:
    return bool(settings.AUDIT_SIEM_ENABLED and settings.AUDIT_SIEM_ENDPOINT)


async def ship_event(event: dict) -> None:
    """Best-effort POST of one audit event to the SIEM. Never raises."""
    if not _enabled():
        return
    headers = {"Content-Type": "application/json"}
    if settings.AUDIT_SIEM_TOKEN:
        headers["Authorization"] = f"Bearer {settings.AUDIT_SIEM_TOKEN}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                settings.AUDIT_SIEM_ENDPOINT, json=event, headers=headers
            )
            if resp.status_code >= 400:
                logger.warning(
                    "SIEM rejected audit event (status %s)", resp.status_code
                )
    except Exception as exc:  # network / timeout / DNS — degrade, never break
        logger.warning("Failed to ship audit event to SIEM: %s", exc)
