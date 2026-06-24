"""Policy rules (CHOS-402).

Each rule inspects ``(subject, action, resource)`` and returns:
  * a ``Decision(allowed=True, …)``  → it ALLOWS,
  * a ``Decision(allowed=False, …)`` → it DENIES,
  * ``None``                          → it ABSTAINS (not applicable).

The engine combines verdicts with **deny-overrides** on top of a **deny-by-
default** base (see engine.py). Together these rules reproduce the CURRENT RBAC
expressed imperatively in ``src/database/deps.py`` — that equivalence is asserted
exhaustively in ``tests/test_policies.py``, so any drift fails the suite.
"""

from __future__ import annotations

from typing import Callable, Optional

from app.domain.policies.attributes import (
    Action,
    DataClass,
    Role,
    SCOPED_ACTIONS,
)
from app.domain.policies.models import Decision, Resource, Subject, allow, deny

Rule = Callable[[Subject, Action, Resource], Optional[Decision]]


def r_superadmin_allows_everything(
    s: Subject, a: Action, r: Resource
) -> Optional[Decision]:
    # SUPER_ADMIN passes every gate in deps.py (require_admin, require_staff, …),
    # so it is allowed for every action. The only super-admin-EXCLUSIVE action
    # (ADMINISTER) is handled by denying everyone else, not by limiting this.
    if s.role == Role.SUPER_ADMIN:
        return allow("super_admin has unrestricted access")
    return None


def r_administer_is_superadmin_only(
    s: Subject, a: Action, r: Resource
) -> Optional[Decision]:
    if a == Action.ADMINISTER and s.role != Role.SUPER_ADMIN:
        return deny("Super admin access required for this action.")
    return None


def r_manage_global(s: Subject, a: Action, r: Resource) -> Optional[Decision]:
    # require_admin: ADMIN / SUPER_ADMIN only. SUPER_ADMIN is granted by the
    # first rule, so ABSTAIN here for it — a deny would override that allow under
    # deny-overrides. Only the roles that genuinely lack the capability are denied.
    if a == Action.MANAGE_GLOBAL:
        if s.role == Role.ADMIN:
            return allow("admin may manage global resources")
        if s.role in (Role.ORGANIZATION, Role.FEDERATION):
            return deny("Admin access required for this action.")
    return None


def r_reveal_pii(s: Subject, a: Action, r: Resource) -> Optional[Decision]:
    # Reveal of Restricted-PII is admin/super-admin only. SUPER_ADMIN via the
    # first rule (abstain here); deny only the roles that lack the capability.
    if a == Action.REVEAL_PII:
        if s.role == Role.ADMIN:
            return allow("admin may reveal restricted PII")
        if s.role in (Role.ORGANIZATION, Role.FEDERATION):
            return deny("Admin access required to reveal restricted PII.")
    return None


def r_staff(s: Subject, a: Action, r: Resource) -> Optional[Decision]:
    # require_staff: ADMIN / SUPER_ADMIN / FEDERATION; blocks ORGANIZATION.
    # SUPER_ADMIN via the first rule (abstain here).
    if a == Action.STAFF:
        if s.role in (Role.ADMIN, Role.FEDERATION):
            return allow("staff role")
        if s.role == Role.ORGANIZATION:
            return deny("Staff access required for this action.")
    return None


def r_scoped_admin(s: Subject, a: Action, r: Resource) -> Optional[Decision]:
    if a in SCOPED_ACTIONS and s.role == Role.ADMIN:
        return allow("admin may act on any scope")
    return None


def r_scoped_federation(s: Subject, a: Action, r: Resource) -> Optional[Decision]:
    # FEDERATION is sport-scoped: it may act on sport-agnostic resources (org/
    # global) and on resources of its OWN sport, but not another sport's.
    if a in SCOPED_ACTIONS and s.role == Role.FEDERATION:
        if r.sport_id is None:
            return allow("federation may act on non-sport-scoped resources")
        if s.sport_id is not None and r.sport_id == s.sport_id:
            return allow("federation acting within its own sport")
        return deny("Federation may only act within its own sport.")
    return None


def r_scoped_organization(s: Subject, a: Action, r: Resource) -> Optional[Decision]:
    # ORGANIZATION is org-scoped: it may only touch its OWN organization's data,
    # may READ (but not write) non-org-scoped resources, and may never manage
    # sport-level resources.
    if a in SCOPED_ACTIONS and s.role == Role.ORGANIZATION:
        if r.sport_id is not None and r.organization_id is None:
            return deny("Organization users cannot manage sport-level resources.")
        if r.organization_id is None:
            if a == Action.READ:
                return allow("organization may read non-org-scoped resources")
            return deny("Organization users cannot manage global resources.")
        if r.organization_id == s.organization_id:
            return allow("organization acting within its own organization")
        return deny(
            "Access denied: you can only access your own organization's data."
        )
    return None


def r_restricted_pii_dataclass(
    s: Subject, a: Action, r: Resource
) -> Optional[Decision]:
    # Defense in depth: any attempt to REVEAL a resource classified RESTRICTED_PII
    # is gated to admin/super-admin regardless of the (kind) — the data CLASS, not
    # the resource type, drives the gate.
    if r.data_class == DataClass.RESTRICTED_PII and a == Action.REVEAL_PII:
        if s.role in (Role.ADMIN, Role.SUPER_ADMIN):
            return allow("privileged role may reveal restricted PII")
        return deny("Restricted PII may only be revealed by an administrator.")
    return None


# Order is irrelevant for correctness (deny-overrides), but listed allow-rules
# first then deny-rules for readability.
DEFAULT_RULES: list[Rule] = [
    r_superadmin_allows_everything,
    r_administer_is_superadmin_only,
    r_manage_global,
    r_reveal_pii,
    r_staff,
    r_scoped_admin,
    r_scoped_federation,
    r_scoped_organization,
    r_restricted_pii_dataclass,
]
