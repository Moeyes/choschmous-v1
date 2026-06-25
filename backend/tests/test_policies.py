"""ABAC policy-engine tests (CHOS-402).

Two jobs:
  1. Prove the engine is deny-by-default with deny-overrides.
  2. Prove it reproduces the EXACT RBAC the deps.py gates used to encode, so the
     wiring in deps.py is a behaviour-preserving refactor (org / sport / data-
     class attributes included).
"""

import pytest

from app.domain.policies import (
    Action,
    DataClass,
    Resource,
    Role,
    Subject,
    policy,
)

SUPER = Subject(role=Role.SUPER_ADMIN)
ADMIN = Subject(role=Role.ADMIN)
FED = Subject(role=Role.FEDERATION, sport_id=3)
ORG = Subject(role=Role.ORGANIZATION, organization_id=7)


# ── deny-by-default ──────────────────────────────────────────────────────────
def test_unknown_action_resource_is_denied_by_default():
    # An action no rule grants → denied, with a deny-by-default reason.
    d = policy.authorize(ORG, Action.REVIEW, Resource(kind="something", sport_id=99))
    assert d.allowed is False
    assert "deny-by-default" in d.reason or "sport" in d.reason


def test_deny_overrides_any_allow():
    # ORGANIZATION reading another org's resource is denied even though a generic
    # read might otherwise seem innocuous — explicit deny wins.
    d = policy.authorize(
        ORG, Action.READ, Resource(kind="enrollment", organization_id=999)
    )
    assert d.allowed is False


# ── require_admin equivalence (MANAGE_GLOBAL) ────────────────────────────────
@pytest.mark.parametrize(
    "subject,expected",
    [(SUPER, True), (ADMIN, True), (FED, False), (ORG, False)],
)
def test_manage_global_matches_require_admin(subject, expected):
    assert policy.can(subject, Action.MANAGE_GLOBAL, Resource(kind="admin")) is expected


# ── require_superadmin equivalence (ADMINISTER) ──────────────────────────────
@pytest.mark.parametrize(
    "subject,expected",
    [(SUPER, True), (ADMIN, False), (FED, False), (ORG, False)],
)
def test_administer_matches_require_superadmin(subject, expected):
    assert (
        policy.can(subject, Action.ADMINISTER, Resource(kind="superadmin")) is expected
    )


# ── require_staff equivalence (STAFF) ────────────────────────────────────────
@pytest.mark.parametrize(
    "subject,expected",
    [(SUPER, True), (ADMIN, True), (FED, True), (ORG, False)],
)
def test_staff_matches_require_staff(subject, expected):
    assert policy.can(subject, Action.STAFF, Resource(kind="staff")) is expected


# ── PII reveal (REVEAL_PII + RESTRICTED_PII) ─────────────────────────────────
@pytest.mark.parametrize(
    "subject,expected",
    [(SUPER, True), (ADMIN, True), (FED, False), (ORG, False)],
)
def test_reveal_pii_admin_only(subject, expected):
    r = Resource(kind="participant_pii", data_class=DataClass.RESTRICTED_PII)
    assert policy.can(subject, Action.REVEAL_PII, r) is expected


# ── enforce_org_access equivalence (org-scoped READ) ─────────────────────────
def test_org_access_org_user_own_org_allowed():
    assert policy.can(
        ORG, Action.READ, Resource(kind="organization", organization_id=7)
    )


def test_org_access_org_user_other_org_denied():
    assert not policy.can(
        ORG, Action.READ, Resource(kind="organization", organization_id=8)
    )


@pytest.mark.parametrize("subject", [SUPER, ADMIN, FED])
def test_org_access_non_org_roles_pass_through(subject):
    # admin / super_admin / federation pass enforce_org_access for any org.
    assert policy.can(
        subject, Action.READ, Resource(kind="organization", organization_id=8)
    )


# ── federation sport scoping ─────────────────────────────────────────────────
def test_federation_confined_to_own_sport_for_writes():
    own = Resource(kind="category", sport_id=3)
    other = Resource(kind="category", sport_id=4)
    assert policy.can(FED, Action.UPDATE, own)
    assert not policy.can(FED, Action.UPDATE, other)


def test_federation_may_act_on_non_sport_resources():
    assert policy.can(FED, Action.READ, Resource(kind="event"))


# ── organization scoping ─────────────────────────────────────────────────────
def test_organization_cannot_manage_sport_level_resources():
    assert not policy.can(ORG, Action.UPDATE, Resource(kind="sport", sport_id=3))


def test_organization_can_read_but_not_write_global_resources():
    assert policy.can(ORG, Action.READ, Resource(kind="event"))
    assert not policy.can(ORG, Action.CREATE, Resource(kind="event"))


# ── engine-core unit tests (CHOS-503 mutation coverage) ──────────────────────
# These pin the deny-by-default / deny-overrides CORE precisely (independent of
# the DEFAULT_RULES set) so a mutation in engine.py / models.py breaks a test.
from app.domain.policies.engine import PolicyEngine  # noqa: E402
from app.domain.policies.models import allow, deny  # noqa: E402


def test_allow_and_deny_helpers_carry_their_reason():
    a = allow("granted-because")
    assert a.allowed is True and a.reason == "granted-because" and bool(a) is True
    d = deny("nope")
    assert d.allowed is False and d.reason == "nope" and bool(d) is False


def test_engine_honours_provided_rules_not_the_defaults():
    # Empty rule set → deny-by-default for everything (no fallback to DEFAULT_RULES).
    empty = PolicyEngine([])
    dec = empty.authorize(SUPER, Action.READ, Resource(kind="event"))
    assert dec.allowed is False
    assert "deny-by-default" in dec.reason

    # A provided always-allow rule is actually used.
    def always_allow(s, a, r):
        return allow("yes")

    assert PolicyEngine([always_allow]).can(ORG, Action.READ, Resource(kind="event"))


def test_explicit_deny_overrides_allow_regardless_of_order():
    def allow_rule(s, a, r):
        return allow("ok")

    def deny_rule(s, a, r):
        return deny("blocked")

    def abstain(s, a, r):
        return None

    # allow alone → allow (and the reason is the rule's).
    d = PolicyEngine([allow_rule]).authorize(ORG, Action.READ, Resource(kind="e"))
    assert d.allowed is True and d.reason == "ok"
    # a deny anywhere (before OR after an allow) wins.
    assert not PolicyEngine([allow_rule, deny_rule]).can(ORG, Action.READ, Resource(kind="e"))
    assert not PolicyEngine([deny_rule, allow_rule]).can(ORG, Action.READ, Resource(kind="e"))
    # abstaining rules are skipped; the first allow is returned.
    d2 = PolicyEngine([abstain, allow_rule]).authorize(ORG, Action.READ, Resource(kind="e"))
    assert d2.allowed is True and d2.reason == "ok"


def test_deny_by_default_reason_names_action_and_kind():
    d = PolicyEngine([]).authorize(ORG, Action.MANAGE_GLOBAL, Resource(kind="widget"))
    assert d.allowed is False
    assert "widget" in d.reason
    assert getattr(Action.MANAGE_GLOBAL, "value", "") in d.reason
    assert "deny-by-default" in d.reason
