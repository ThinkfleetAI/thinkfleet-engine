---
name: airtable
description: "Manage Airtable bases, tables, and records via the REST API."
metadata: {"moltbot":{"emoji":"📊","requires":{"bins":["curl","jq"],"env":["AIRTABLE_ACCESS_TOKEN"]}}}
---

# Airtable

Manage Airtable bases and records via the REST API.

## Environment Variables

- `AIRTABLE_ACCESS_TOKEN` - Personal access token (generate at https://airtable.com/create/tokens)

## List records

```bash
curl -s -H "Authorization: Bearer $AIRTABLE_ACCESS_TOKEN" \
  "https://api.airtable.com/v0/BASE_ID/TABLE_NAME?maxRecords=20" | jq '.records[] | {id, fields}'
```

## Get record

```bash
curl -s -H "Authorization: Bearer $AIRTABLE_ACCESS_TOKEN" \
  "https://api.airtable.com/v0/BASE_ID/TABLE_NAME/RECORD_ID" | jq '{id, fields}'
```

## Create record

```bash
curl -s -X POST -H "Authorization: Bearer $AIRTABLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.airtable.com/v0/BASE_ID/TABLE_NAME" \
  -d '{"records":[{"fields":{"Name":"New record","Status":"Active"}}]}' | jq '.records[] | {id, fields}'
```

## Update record

```bash
curl -s -X PATCH -H "Authorization: Bearer $AIRTABLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.airtable.com/v0/BASE_ID/TABLE_NAME" \
  -d '{"records":[{"id":"RECORD_ID","fields":{"Status":"Done"}}]}' | jq '.records[] | {id, fields}'
```

## Delete record

```bash
curl -s -X DELETE -H "Authorization: Bearer $AIRTABLE_ACCESS_TOKEN" \
  "https://api.airtable.com/v0/BASE_ID/TABLE_NAME/RECORD_ID" | jq '{id, deleted}'
```

## List bases

```bash
curl -s -H "Authorization: Bearer $AIRTABLE_ACCESS_TOKEN" \
  "https://api.airtable.com/v0/meta/bases" | jq '.bases[] | {id, name, permissionLevel}'
```

## Get base schema

```bash
curl -s -H "Authorization: Bearer $AIRTABLE_ACCESS_TOKEN" \
  "https://api.airtable.com/v0/meta/bases/BASE_ID/tables" | jq '.tables[] | {id, name, fields: [.fields[] | {id, name, type}]}'
```
