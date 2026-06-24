"""The ABAC policy engine (CHOS-402).

Deny-by-default with a deny-overrides combining algorithm:

  1. Evaluate every rule.
  2. If ANY rule denies → **deny** (an explicit deny always wins; no allow can
     override a deny — the conservative choice for a public-sector system).
  3. Else if ANY rule allows → **allow**.
  4. Else (no rule applied) → **deny** ("deny-by-default": access must be
     positively granted, never assumed).

This is a self-contained engine rather than an OPA-server / Casbin dependency:
the deployment is network-isolated (no sidecar) and the rule set must be unit-
testable and versioned with the code. The rule vocabulary (Subject / Resource /
Action / DataClass) is exactly the ABAC shape OPA/Casbin model, so the rules in
``rules.py`` could be transcribed to Rego/Casbin later without touching callers.

TODO(infra, optional): if a central OPA is later mandated, keep this engine as
the in-process fail-closed fallback and add an OPA adapter behind the same
``authorize()`` signature.
"""

from __future__ import annotations

from app.domain.policies.attributes import Action
from app.domain.policies.models import Decision, Resource, Subject, deny
from app.domain.policies.rules import DEFAULT_RULES, Rule


class PolicyEngine:
    def __init__(self, rules: list[Rule] | None = None):
        self._rules = list(rules if rules is not None else DEFAULT_RULES)

    def authorize(
        self, subject: Subject, action: Action, resource: Resource
    ) -> Decision:
        """Return the access Decision (deny-by-default, deny-overrides)."""
        first_allow: Decision | None = None
        for rule in self._rules:
            verdict = rule(subject, action, resource)
            if verdict is None:
                continue
            if not verdict.allowed:
                return verdict  # explicit deny short-circuits (deny-overrides)
            if first_allow is None:
                first_allow = verdict
        if first_allow is not None:
            return first_allow
        return deny(
            f"No policy grants {getattr(action, 'value', action)} on "
            f"{resource.kind} (deny-by-default)."
        )

    def can(self, subject: Subject, action: Action, resource: Resource) -> bool:
        return self.authorize(subject, action, resource).allowed


# The process-wide default engine. Stateless and pure, so a single shared
# instance is safe across requests/threads.
policy = PolicyEngine()
