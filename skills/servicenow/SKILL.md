---
name: servicenow
description: "Query and manage ServiceNow — incidents, changes, problems, and catalog items via the Table API."
metadata: {"thinkfleetbot":{"emoji":"🎫","requires":{"bins":["curl","jq"],"env":["SERVICENOW_INSTANCE","SERVICENOW_USER","SERVICENOW_PASSWORD"]}}}
---

# ServiceNow

Query and manage incidents, changes, and service catalog items.

## Environment Variables

- `SERVICENOW_INSTANCE` - Instance name (e.g. `mycompany` for `mycompany.service-now.com`)
- `SERVICENOW_USER` - Username
- `SERVICENOW_PASSWORD` - Password

## List incidents

```bash
curl -s -u "$SERVICENOW_USER:$SERVICENOW_PASSWORD" \
  -H "Accept: application/json" \
  "https://$SERVICENOW_INSTANCE.service-now.com/api/now/table/incident?sysparm_limit=10&sysparm_fields=number,short_description,state,priority,assigned_to" | jq '.result[]'
```

## Create incident

```bash
curl -s -X POST -u "$SERVICENOW_USER:$SERVICENOW_PASSWORD" \
  -H "Content-Type: application/json" \
  "https://$SERVICENOW_INSTANCE.service-now.com/api/now/table/incident" \
  -d '{"short_description":"Issue summary","description":"Detailed description","urgency":"2","impact":"2"}' | jq '.result | {number, sys_id}'
```

## List change requests

```bash
curl -s -u "$SERVICENOW_USER:$SERVICENOW_PASSWORD" \
  -H "Accept: application/json" \
  "https://$SERVICENOW_INSTANCE.service-now.com/api/now/table/change_request?sysparm_limit=10&sysparm_fields=number,short_description,state,type" | jq '.result[]'
```

## Update incident

```bash
curl -s -X PATCH -u "$SERVICENOW_USER:$SERVICENOW_PASSWORD" \
  -H "Content-Type: application/json" \
  "https://$SERVICENOW_INSTANCE.service-now.com/api/now/table/incident/SYS_ID" \
  -d '{"state":"6","close_notes":"Resolved by automation"}' | jq '.result | {number, state}'
```

## Notes

- Always confirm before creating or closing incidents.
