---
name: snowflake
description: "Query Snowflake data warehouse — execute SQL, manage warehouses, and query metadata via the SQL API."
metadata: {"thinkfleetbot":{"emoji":"❄️","requires":{"bins":["curl","jq"],"env":["SNOWFLAKE_ACCOUNT","SNOWFLAKE_USER","SNOWFLAKE_PASSWORD"]}}}
---

# Snowflake

Execute SQL queries and manage warehouses via the Snowflake SQL API.

## Environment Variables

- `SNOWFLAKE_ACCOUNT` - Account identifier (e.g. `abc12345.us-east-1`)
- `SNOWFLAKE_USER` - Username
- `SNOWFLAKE_PASSWORD` - Password

## Execute SQL

```bash
curl -s -X POST \
  "https://$SNOWFLAKE_ACCOUNT.snowflakecomputing.com/api/v2/statements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SNOWFLAKE_PASSWORD" \
  -d '{"statement":"SELECT * FROM my_table LIMIT 10","warehouse":"COMPUTE_WH","database":"MY_DB","schema":"PUBLIC"}' | jq '{statementHandle, data: .data[:5]}'
```

## List databases

```bash
curl -s -X POST \
  "https://$SNOWFLAKE_ACCOUNT.snowflakecomputing.com/api/v2/statements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SNOWFLAKE_PASSWORD" \
  -d '{"statement":"SHOW DATABASES","warehouse":"COMPUTE_WH"}' | jq '.data[]'
```

## Notes

- SQL API requires key-pair or OAuth auth in production.
- Always confirm before running DDL or DML statements.
