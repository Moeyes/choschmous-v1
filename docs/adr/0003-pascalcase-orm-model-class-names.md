# ADR-0003: PascalCase ORM model class names

- **Status:** accepted
- **Date:** 2026-06-25
- **Deciders:** Platform team
- **Ticket:** CHOS-506

## Context

SQLAlchemy model classes were inconsistently named: some PascalCase (`User`,
`Enroll`, `Events`) and many snake_case/lowercase (`athletes`, `team`,
`category`, `sports_event`, `participation_per_sport`, …). Lowercase class names
read like instances or tables, collide visually with local variables and column
attributes (e.g. a `category` class next to a `category` column and a `category`
local), and violate PEP 8. New contributors could not tell a class from a row.

## Decision

We will name every SQLAlchemy model class in **PascalCase** (`Athlete`, `Team`,
`Category`, `SportsEvent`, `ParticipationPerSport`, …). The database is
untouched: each model keeps its existing `__tablename__`, so the rename is
**migration-safe** — no schema change, no Alembic revision required.

Importers use the class directly or alias as needed; relationship targets and
`Mapped[...]` forward-refs use the new class names; `.mappings()` row keys (which
are keyed by the class `__name__`) were updated accordingly.

## Consequences

- Positive: PEP 8 compliant; a class is visually distinct from an instance,
  variable, and column; consistent with `User`/`Events`/`Sport`.
- Negative: a large one-time rename touching imports across services, routes,
  app layer, tests, and seed scripts.
- Follow-ups: new models MUST be PascalCase with an unchanged, explicit
  `__tablename__`. The full backend test suite (268) passed unchanged, proving
  no behavioural drift.

## Alternatives considered

- **Leave as-is** — perpetuates the class/instance/column ambiguity; rejected.
- **Also rename tables to match** — would force a data migration with downtime
  risk for zero functional gain; rejected (tables stay).
