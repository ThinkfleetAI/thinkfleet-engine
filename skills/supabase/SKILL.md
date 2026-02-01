---
name: supabase
description: "Query Supabase — database tables, auth users, storage, and edge functions via the REST API."
metadata: {"moltbot":{"emoji":"⚡","requires":{"bins":["curl","jq"],"env":["SUPABASE_URL","SUPABASE_SERVICE_KEY"]}}}
---

# Supabase

Query database tables, manage auth users, and storage.

## Environment Variables

- `SUPABASE_URL` - Project URL (e.g. `https://abc.supabase.co`)
- `SUPABASE_SERVICE_KEY` - Service role key

## Query table

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/TABLE_NAME?select=*&limit=10" | jq '.[]'
```

## Insert row

```bash
curl -s -X POST -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/TABLE_NAME" \
  -d '{"column1":"value1","column2":"value2"}' | jq '.'
```

## List auth users

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/auth/v1/admin/users?per_page=10" | jq '.users[] | {id, email, created_at}'
```

## List storage buckets

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/storage/v1/bucket" | jq '.[] | {id, name, public}'
```

## Notes

- Service key has full access. Always confirm before modifying data.
