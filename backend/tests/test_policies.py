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
    assert (
        policy.can(subject, Action.MANAGE_GLOBAL, Resource(kind="admin")) is expected
    )


# ── require_superadmin equivalence (ADMINISTER) ──────────────────────────────
@pytest.mark.parametrize(
    "subject,expected",
    [(SUPER, True), (ADMIN, False), (FED, False), (ORG, False)],
)
def test_administer_matches_require_superadmin(subject, expected):
    assert (
        policy.can(subject, Action.ADMINISTER, Resource(kind="superadmin"))
        is expected
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
