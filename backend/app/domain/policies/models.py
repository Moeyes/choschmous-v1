"""Value objects passed to the policy engine (CHOS-402)."""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.policies.attributes import DataClass, Role


@dataclass(frozen=True)
class Subject:
    """The actor a decision is made for. Built from a ``User`` in deps.py."""

    role: Role
    user_id: str | None = None
    organization_id: int | None = None
    sport_id: int | None = None


@dataclass(frozen=True)
class Resource:
    """The thing being accessed, described by its access-relevant attributes.

    All scope attributes default to ``None`` (= "not scoped / not applicable"),
    so a global resource is simply ``Resource(kind="event")`` and an org-scoped
    one is ``Resource(kind="enrollment", organization_id=7)``.
    """

    kind: str
    organization_id: int | None = None
    sport_id: int | None = None
    review_state: str | None = None
    data_class: DataClass = DataClass.INTERNAL
    owner_id: str | None = None


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str

    def __bool__(self) -> bool:  # so `if decision:` works intuitively
        return self.allowed


# Module-level singletons to avoid re-allocating common verdicts.
def allow(reason: str) -> Decision:
    return Decision(True, reason)


def deny(reason: str) -> Decision:
    return Decision(False, reason)
