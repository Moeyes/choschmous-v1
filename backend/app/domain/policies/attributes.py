"""Attribute vocabularies for the ABAC policy engine (CHOS-402).

These are the *attributes* the policy reasons over — the A in ABAC. They are
deliberately plain values (strings / enums), decoupled from the SQLAlchemy enums
in ``src/models`` so the domain policy layer stays framework- and persistence-
agnostic. ``deps.py`` maps a ``User`` onto a ``Subject`` carrying the role string
+ org/sport ids; callers describe the thing being accessed as a ``Resource``.
"""

from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """Mirrors ``src.models.enum.user.UserRole`` *values* (kept in lock-step)."""

    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ORGANIZATION = "organization"
    FEDERATION = "federation"


class Action(str, Enum):
    """What the subject is trying to do. Capability-style actions (ADMINISTER /
    MANAGE_GLOBAL / STAFF / REVEAL_PII) model the existing role gates in
    ``deps.py``; the CRUD actions are evaluated against the resource's scope."""

    ADMINISTER = "administer"  # super-admin-only management
    MANAGE_GLOBAL = "manage_global"  # admin/super-admin: global resources
    STAFF = "staff"  # cross-org staff (blocks plain ORGANIZATION)
    REVEAL_PII = "reveal_pii"  # admin/super-admin: reveal Restricted-PII
    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    REVIEW = "review"


# Scope-checked CRUD/review actions (vs. the capability actions above).
SCOPED_ACTIONS = frozenset(
    {Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE, Action.REVIEW}
)
WRITE_ACTIONS = frozenset(
    {Action.CREATE, Action.UPDATE, Action.DELETE, Action.REVIEW}
)


class DataClass(str, Enum):
    """Data-governance classification of the resource (matches the frontend
    data-governance taxonomy). RESTRICTED_PII is the only class with a dedicated
    access gate (reveal) in the current system."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED_PII = "restricted_pii"


class ReviewState(str, Enum):
    """Common review-workflow states, available as a resource attribute so future
    policies can gate edits on review status (e.g. lock an APPROVED record)."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
