"""Attribute-based access-control policy engine (CHOS-402).

Deny-by-default ABAC over org / sport / review-state / data-class attributes,
reproducing — and centralising — the RBAC previously expressed imperatively in
``src/database/deps.py``. Import the shared ``policy`` engine and the value
objects from here.
"""

from app.domain.policies.attributes import (
    Action,
    DataClass,
    ReviewState,
    Role,
)
from app.domain.policies.engine import PolicyEngine, policy
from app.domain.policies.models import Decision, Resource, Subject, allow, deny

__all__ = [
    "Action",
    "DataClass",
    "ReviewState",
    "Role",
    "PolicyEngine",
    "policy",
    "Decision",
    "Resource",
    "Subject",
    "allow",
    "deny",
]
