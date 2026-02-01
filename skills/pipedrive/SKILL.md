---
name: pipedrive
description: "Manage Pipedrive CRM — persons, organizations, deals, and activities via the REST API."
metadata: {"thinkfleetbot":{"emoji":"🔧","requires":{"bins":["curl","jq"],"env":["PIPEDRIVE_API_TOKEN","PIPEDRIVE_DOMAIN"]}}}
---

# Pipedrive

Manage persons, organizations, deals, and activities.

## Environment Variables

- `PIPEDRIVE_API_TOKEN` - API token
- `PIPEDRIVE_DOMAIN` - Company domain (e.g. `mycompany`)

## List deals

```bash
curl -s "https://$PIPEDRIVE_DOMAIN.pipedrive.com/api/v1/deals?api_token=$PIPEDRIVE_API_TOKEN&limit=10" | jq '.data[] | {id, title, value, currency, status}'
```

## List persons

```bash
curl -s "https://$PIPEDRIVE_DOMAIN.pipedrive.com/api/v1/persons?api_token=$PIPEDRIVE_API_TOKEN&limit=10" | jq '.data[] | {id, name, email: .email[0].value, phone: .phone[0].value}'
```

## Create deal

```bash
curl -s -X POST "https://$PIPEDRIVE_DOMAIN.pipedrive.com/api/v1/deals?api_token=$PIPEDRIVE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Deal","value":5000,"currency":"USD"}' | jq '.data | {id, title, value}'
```

## Notes

- Always confirm before creating or updating records.
