---
name: freshdesk
description: "Manage Freshdesk support — tickets, contacts, and agents via the REST API."
metadata: {"thinkfleetbot":{"emoji":"🎧","requires":{"bins":["curl","jq"],"env":["FRESHDESK_DOMAIN","FRESHDESK_API_KEY"]}}}
---

# Freshdesk

Manage support tickets, contacts, and agents.

## Environment Variables

- `FRESHDESK_DOMAIN` - Domain (e.g. `mycompany` for `mycompany.freshdesk.com`)
- `FRESHDESK_API_KEY` - API key

## List tickets

```bash
curl -s -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/tickets?per_page=10" | jq '.[] | {id, subject, status, priority}'
```

## Create ticket

```bash
curl -s -X POST -u "$FRESHDESK_API_KEY:X" \
  -H "Content-Type: application/json" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/tickets" \
  -d '{"subject":"Issue","description":"Details here","email":"user@example.com","priority":2,"status":2}' | jq '{id, subject}'
```

## List contacts

```bash
curl -s -u "$FRESHDESK_API_KEY:X" \
  "https://$FRESHDESK_DOMAIN.freshdesk.com/api/v2/contacts?per_page=10" | jq '.[] | {id, name, email}'
```

## Notes

- Always confirm before creating or updating tickets.
