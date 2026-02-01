---
name: architecture-decision-records
description: "Create and manage Architecture Decision Records (ADRs): document technical decisions, alternatives considered, and rationale."
metadata: {"thinkfleetbot":{"emoji":"📋","requires":{"anyBins":["git"]}}}
---

# Architecture Decision Records

Document significant technical decisions so future you (and your team) understands *why*.

## Create an ADR

### Standard format

```markdown
# ADR-001: Use PostgreSQL for primary database

## Status
Accepted

## Date
2024-01-15

## Context
We need a primary database for the application. Requirements:
- Relational data with complex queries
- Full-text search capability
- JSON column support for flexible schemas
- Strong consistency guarantees

## Decision
Use PostgreSQL with pgvector extension for vector similarity search.

## Alternatives Considered

### MySQL
- Pros: Familiar to team, wide hosting support
- Cons: Weaker JSON support, no native vector search
- Rejected: Missing key features we need

### MongoDB
- Pros: Flexible schema, good for document storage
- Cons: Weaker consistency, complex transactions
- Rejected: Our data is fundamentally relational

## Consequences
- Team needs PostgreSQL expertise
- Hosting on Supabase (managed Postgres)
- pgvector enables future AI/semantic search features
- Migration path exists if we need to switch (standard SQL)
```

## Directory Structure

```
docs/
  adr/
    000-template.md
    001-use-postgresql.md
    002-adopt-nextjs-app-router.md
    003-api-authentication-strategy.md
    README.md  # Index of all ADRs
```

## ADR Index

```bash
# Generate index from ADR files
echo "# Architecture Decision Records" > docs/adr/README.md
echo "" >> docs/adr/README.md
for f in docs/adr/[0-9]*.md; do
  title=$(head -1 "$f" | sed 's/^# //')
  status=$(grep "^## Status" -A1 "$f" | tail -1)
  echo "- [$title]($f) — $status" >> docs/adr/README.md
done
```

## When to Write an ADR

- Choosing a framework, language, or database
- Changing authentication/authorization approach
- Adopting a new deployment strategy
- Major refactoring decisions
- Third-party service selection
- API design decisions (REST vs GraphQL, versioning strategy)

## When NOT to Write an ADR

- Routine bug fixes
- Minor library version updates
- Code style changes (use linter config instead)
- Anything that doesn't affect other developers

## Updating ADRs

Don't edit old ADRs. If a decision changes, write a new ADR that supersedes the old one:

```markdown
## Status
Superseded by [ADR-007](007-switch-to-supabase-auth.md)
```

## Notes

- ADRs are immutable history. They record what was decided and why *at that time*.
- Keep them short. One page is ideal. If it's longer, the decision might be too complex.
- Store ADRs in the repo, not in a wiki. They should travel with the code.
- The "Alternatives Considered" section is the most valuable part — it prevents re-litigating decisions.
