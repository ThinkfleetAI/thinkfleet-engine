---
name: database-optimization
description: "Query performance tuning, EXPLAIN analysis, index strategies, slow query detection, and connection pool management."
metadata: {"moltbot":{"emoji":"🏎️","requires":{"anyBins":["psql","mysql"]}}}
---

# Database Optimization

Diagnose and fix slow queries, optimize indexes, and tune database performance.

## EXPLAIN Analysis

### PostgreSQL

```bash
# Basic explain
psql $DATABASE_URL -c "EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';"

# With actual execution stats
psql $DATABASE_URL -c "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM users WHERE email = 'test@example.com';"

# JSON format for tooling
psql $DATABASE_URL -c "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM users WHERE status = 'active';"
```

### MySQL

```bash
# Basic explain
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';"

# Extended explain
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "EXPLAIN FORMAT=JSON SELECT * FROM users WHERE email = 'test@example.com';"
```

### What to look for

- **Seq Scan** on large tables = missing index
- **Nested Loop** with high row counts = consider JOIN optimization
- **Sort** without index = add index on ORDER BY columns
- **Hash Join** on large datasets = check memory settings
- **Rows** estimate far from actual = run `ANALYZE` to update statistics

## Index Management

### PostgreSQL

```bash
# List all indexes
psql $DATABASE_URL -c "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;"

# Find unused indexes
psql $DATABASE_URL -c "SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY relname;"

# Find missing indexes (tables with seq scans)
psql $DATABASE_URL -c "SELECT relname, seq_scan, seq_tup_read, idx_scan FROM pg_stat_user_tables WHERE seq_scan > 1000 ORDER BY seq_scan DESC LIMIT 20;"

# Create index
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY idx_users_email ON users(email);"

# Create composite index
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY idx_orders_user_date ON orders(user_id, created_at DESC);"

# Index size
psql $DATABASE_URL -c "SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) FROM pg_stat_user_indexes ORDER BY pg_relation_size(indexrelid) DESC LIMIT 10;"
```

## Slow Query Detection

### PostgreSQL

```bash
# Currently running queries (sorted by duration)
psql $DATABASE_URL -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND query NOT ILIKE '%pg_stat%' ORDER BY duration DESC LIMIT 10;"

# Enable slow query log (in postgresql.conf or per-session)
psql $DATABASE_URL -c "SET log_min_duration_statement = 1000;"  -- log queries > 1s

# Table statistics
psql $DATABASE_URL -c "SELECT relname, n_live_tup, n_dead_tup, last_vacuum, last_analyze FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;"
```

### MySQL

```bash
# Show slow query log status
mysql -e "SHOW VARIABLES LIKE 'slow_query%';"

# Currently running queries
mysql -e "SHOW FULL PROCESSLIST;" | grep -v Sleep
```

## Table Maintenance

```bash
# PostgreSQL — update statistics
psql $DATABASE_URL -c "ANALYZE users;"
psql $DATABASE_URL -c "ANALYZE;"  -- all tables

# PostgreSQL — reclaim dead rows
psql $DATABASE_URL -c "VACUUM ANALYZE users;"

# Table sizes
psql $DATABASE_URL -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total_size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"
```

## Connection Pool Check

```bash
# PostgreSQL — current connections
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Max connections
psql $DATABASE_URL -c "SHOW max_connections;"

# Connection age
psql $DATABASE_URL -c "SELECT pid, usename, application_name, now() - backend_start AS connection_age FROM pg_stat_activity ORDER BY connection_age DESC LIMIT 10;"
```

## Notes

- Run `EXPLAIN ANALYZE` on staging, not production — it actually executes the query.
- `CREATE INDEX CONCURRENTLY` avoids table locks but takes longer.
- Dead rows (`n_dead_tup`) slow queries. Run `VACUUM` regularly or ensure autovacuum is tuned.
- Composite indexes: column order matters. Put equality columns first, range columns last.
- Don't index everything — each index slows writes. Index what you query.
