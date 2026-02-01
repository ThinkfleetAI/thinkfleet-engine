---
name: architecture
description: "Software architecture tools -- generate diagrams (Mermaid, PlantUML), write ADRs, and document design decisions."
metadata: {"thinkfleetbot":{"emoji":"🏛️","requires":{"bins":["python3"]}}}
---

# Architecture

Tools for documenting and visualizing software architecture.

## Mermaid diagrams

Generate Mermaid diagram syntax for rendering in Markdown or docs.

### Sequence diagram

```
sequenceDiagram
    participant Client
    participant API
    participant DB
    Client->>API: POST /login
    API->>DB: SELECT user
    DB-->>API: user record
    API-->>Client: 200 JWT token
```

### Architecture diagram (flowchart)

```
flowchart TD
    LB[Load Balancer] --> API1[API Server 1]
    LB --> API2[API Server 2]
    API1 --> DB[(PostgreSQL)]
    API2 --> DB
    API1 --> Cache[(Redis)]
    API2 --> Cache
    API1 --> Queue[SQS Queue]
    Queue --> Worker[Worker Service]
    Worker --> DB
```

### Entity relationship diagram

```
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
    USER {
        string id PK
        string email
        string name
    }
    ORDER {
        string id PK
        string userId FK
        datetime createdAt
    }
```

### C4 Context (using flowchart)

```
flowchart TD
    User[fa:fa-user User] -->|Uses| WebApp[Web Application]
    WebApp -->|API calls| Backend[Backend Service]
    Backend -->|Reads/Writes| DB[(Database)]
    Backend -->|Sends| Email[Email Service]
    Backend -->|Publishes| Queue[Message Queue]
```

## Architecture Decision Records (ADR)

Write ADRs to `docs/adr/` using the standard template:

```bash
mkdir -p docs/adr
cat > docs/adr/0001-use-postgresql.md << 'EOF'
# 1. Use PostgreSQL as Primary Database

Date: $(date +%Y-%m-%d)

## Status

Accepted

## Context

We need a relational database for our application data.

## Decision

We will use PostgreSQL as our primary database.

## Consequences

- Strong SQL support and JSON capabilities
- Well-supported by our ORM (Prisma/TypeORM)
- Requires operational knowledge for maintenance
EOF
```

### List ADRs

```bash
ls -1 docs/adr/*.md 2>/dev/null | while read f; do head -1 "$f" | sed 's/^# //'; done
```

## PlantUML (text-based)

```
@startuml
actor User
participant "Web App" as Web
participant "API" as API
database "DB" as DB

User -> Web : Login
Web -> API : POST /auth
API -> DB : Query user
DB --> API : User data
API --> Web : JWT
Web --> User : Dashboard
@enduml
```

## Dependency graph (from package.json)

```bash
python3 -c "
import json, sys
pkg = json.load(open('package.json'))
deps = pkg.get('dependencies', {})
name = pkg.get('name', 'app')
lines = ['flowchart LR']
for dep in sorted(deps):
    lines.append(f'    {name} --> {dep}')
print('\n'.join(lines))
"
```

## Notes

- Mermaid renders natively in GitHub Markdown (use ```mermaid code blocks).
- ADRs should be numbered sequentially and never deleted (supersede instead).
- Keep diagrams in version control alongside code.
- Use C4 model levels: Context → Container → Component → Code.
