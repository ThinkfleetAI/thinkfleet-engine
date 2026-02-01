---
name: database-migration
description: "Manage database schema migrations with Flyway, Alembic, Prisma, Knex, and raw SQL migration patterns."
metadata: {"thinkfleetbot":{"emoji":"🔄","requires":{"anyBins":["flyway","alembic","npx","psql","mysql"]}}}
---

# Database Migration

Manage schema changes with versioned, repeatable migrations.

## Prisma (Node.js)

```bash
# Create migration from schema changes
npx prisma migrate dev --name add_users_table

# Apply migrations in production
npx prisma migrate deploy

# Reset database (destroys data)
npx prisma migrate reset

# Check migration status
npx prisma migrate status

# Generate client after schema change
npx prisma generate

# View current schema
npx prisma db pull
```

## Knex (Node.js)

```bash
# Create migration file
npx knex migrate:make add_users_table

# Run pending migrations
npx knex migrate:latest

# Rollback last batch
npx knex migrate:rollback

# Rollback all
npx knex migrate:rollback --all

# Check status
npx knex migrate:status

# Create seed file
npx knex seed:make seed_users

# Run seeds
npx knex seed:run
```

## Alembic (Python/SQLAlchemy)

```bash
# Initialize
alembic init alembic

# Auto-generate migration from model changes
alembic revision --autogenerate -m "add users table"

# Apply all pending
alembic upgrade head

# Rollback one step
alembic downgrade -1

# Check current version
alembic current

# Show migration history
alembic history --verbose

# Generate SQL without applying
alembic upgrade head --sql > migration.sql
```

## Flyway (Java/multi-language)

```bash
# Apply migrations
flyway migrate

# Check status
flyway info

# Validate migrations match applied
flyway validate

# Rollback (Teams edition only)
flyway undo

# Clean database (destroys everything)
flyway clean

# Baseline existing database
flyway baseline
```

## Raw SQL Migrations

```bash
# PostgreSQL — apply migration file
psql $DATABASE_URL -f migrations/001_create_users.sql

# MySQL
mysql -u $DB_USER -p$DB_PASS $DB_NAME < migrations/001_create_users.sql

# Track manually with a versions table
psql $DATABASE_URL -c "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());"
psql $DATABASE_URL -c "INSERT INTO schema_migrations (version) VALUES ('001_create_users');"
```

## Schema Diffing

```bash
# Prisma — diff current DB vs schema
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma

# PostgreSQL — dump schema for comparison
pg_dump --schema-only $DATABASE_URL > schema_current.sql
# Compare with previous
diff schema_previous.sql schema_current.sql
```

## Notes

- Always test migrations on a copy of production data before applying.
- Migrations should be idempotent where possible (`IF NOT EXISTS`, `IF EXISTS`).
- Never edit an already-applied migration. Create a new one.
- For zero-downtime deployments: add columns as nullable first, backfill, then add constraints.
- Back up the database before running migrations in production.
