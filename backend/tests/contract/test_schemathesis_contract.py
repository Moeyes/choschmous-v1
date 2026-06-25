"""CHOS-503 — Schemathesis contract/conformance tests vs the live OpenAPI.

Schemathesis loads the app's own OpenAPI document and (a) validates it parses into
operations and (b) property-based-fuzzes a safe public endpoint, asserting every
response conforms to the declared schema and is not a 5xx.

The pytest conformance scope is deliberately narrow + reliable (the public root
endpoint) so the gate is never flaky. The *full* authenticated fuzz across all
125 operations runs in CI via the ``schemathesis run`` CLI with an auth token —
see ``.github/workflows/contract.yml``.

Skips cleanly if Schemathesis is not installed (offline dev box).
"""

import pytest

schemathesis = pytest.importorskip("schemathesis")

from hypothesis import HealthCheck, settings  # noqa: E402
from schemathesis.checks import CHECKS, load_all_checks  # noqa: E402

from main import app  # noqa: E402

load_all_checks()

schema = schemathesis.openapi.from_asgi("/api/v1/openapi.json", app)

# The core contract assertions: a documented response must (1) never be a 5xx and
# (2) match its declared schema. The negative-testing probes (unsupported_method,
# negative_data_rejection, ...) are intentionally NOT run here — the CSRF
# middleware answers unknown methods with 403 (by design), which those probes
# would flag as noise. The CI CLI job runs the broader set with auth.
_CONTRACT_CHECKS = CHECKS.get_by_names(
    ["not_a_server_error", "response_schema_conformance"]
)


def test_openapi_parses_into_operations():
    """The document Schemathesis derives must have the real API surface."""
    operations = list(schema.get_all_operations())
    assert len(operations) > 50, f"only {len(operations)} operations parsed"


# Conformance smoke on the public, side-effect-free root endpoint. Kept tight so
# the gate is reliable; the broad authenticated fuzz is the CI CLI job.
public_schema = schema.include(path="/api/v1/root/")


@public_schema.parametrize()
@settings(max_examples=10, deadline=None, suppress_health_check=list(HealthCheck))
def test_public_root_conforms(case):
    case.call_and_validate(checks=_CONTRACT_CHECKS)
