---
name: database-query
description: "Execute SQL queries against PostgreSQL (psql) or MySQL (mysql) databases using their CLI clients."
metadata: {"thinkfleetbot":{"emoji":"🗄️","requires":{"bins":["psql"]}}}
---

# Database Query

Execute SQL against PostgreSQL or MySQL via CLI.

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (e.g. `postgres://user:pass@host:5432/db`)
- `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` - MySQL connection params

## PostgreSQL

```bash
psql "$DATABASE_URL" -c "SELECT id, name FROM users LIMIT 10;"
```

CSV output:
```bash
psql "$DATABASE_URL" --csv -c "SELECT * FROM orders WHERE created_at > now() - interval '7 days';"
```

List tables:
```bash
psql "$DATABASE_URL" -c "\dt"
```

Describe table:
```bash
psql "$DATABASE_URL" -c "\d users"
```

## MySQL

```bash
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SELECT id, name FROM users LIMIT 10;"
```

## Safety

- Always use `LIMIT` on SELECT queries unless the user explicitly asks for all rows.
- Never run `DROP`, `TRUNCATE`, or `DELETE` without explicit user confirmation.
- Prefer read-only queries. If a write is needed, confirm with the user first.
