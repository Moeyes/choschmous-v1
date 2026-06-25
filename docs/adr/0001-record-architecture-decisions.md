# ADR-0001: Record architecture decisions

- **Status:** accepted
- **Date:** 2026-06-25
- **Deciders:** Platform team

## Context

This is a long-lived, nation-level system maintained by a rotating team. Several
significant architectural choices (deny-by-default authorization, field-level PII
encryption, multi-AZ topology, progressive delivery) were already made but their
rationale lived only in commit messages and code comments — hard to find and
easy to silently reverse.

## Decision

We will keep an **Architecture Decision Record (ADR) log** in `docs/adr/`. Each
significant, hard-to-reverse decision gets one immutable, numbered Markdown file
(`NNNN-title.md`) using [`template.md`](template.md). ADRs are append-only: a
decision is changed by adding a new ADR that supersedes the old one (which is
marked `superseded by`), never by editing history.

A decision is "ADR-worthy" if it constrains future work, is costly to reverse,
or a newcomer would otherwise ask "why is it done this way?".

## Consequences

- Positive: durable, reviewable rationale; onboarding is faster; reversals are
  deliberate.
- Negative: a small per-decision authoring cost.
- Follow-ups: link ADRs from the code/docs they govern; reference the relevant
  ADR in PRs that change a governed area.

## Alternatives considered

- **Wiki / Confluence** — drifts from the code and is not reviewed in PRs.
- **Only commit messages** — not discoverable; no status lifecycle.
