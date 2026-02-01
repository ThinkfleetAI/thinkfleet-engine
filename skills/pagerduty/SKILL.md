---
name: pagerduty
description: "Manage PagerDuty incidents, services, and on-call schedules via the REST API."
metadata: {"moltbot":{"emoji":"🚨","requires":{"bins":["curl","jq"],"env":["PAGERDUTY_TOKEN"]}}}
---

# PagerDuty

Manage incidents and on-call schedules.

## Environment Variables

- `PAGERDUTY_TOKEN` - PagerDuty API token (v2)

## List open incidents

```bash
curl -s -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.pagerduty.com/incidents?statuses[]=triggered&statuses[]=acknowledged&limit=10" | jq '.incidents[] | {id, title, status, urgency, service: .service.summary, created_at}'
```

## Get incident details

```bash
curl -s -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  "https://api.pagerduty.com/incidents/P1234567" | jq '.incident | {id, title, status, urgency, service: .service.summary, assigned_to: [.assignments[].assignee.summary]}'
```

## Acknowledge incident

```bash
curl -s -X PUT -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.pagerduty.com/incidents" \
  -d '{"incidents": [{"id": "P1234567", "type": "incident_reference", "status": "acknowledged"}]}' | jq '.incidents[0] | {id, status}'
```

## Resolve incident

```bash
curl -s -X PUT -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.pagerduty.com/incidents" \
  -d '{"incidents": [{"id": "P1234567", "type": "incident_reference", "status": "resolved"}]}' | jq '.incidents[0] | {id, status}'
```

## Create incident

```bash
curl -s -X POST -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.pagerduty.com/incidents" \
  -d '{
    "incident": {
      "type": "incident",
      "title": "Database connection pool exhausted",
      "service": {"id": "PSERVICE1", "type": "service_reference"},
      "urgency": "high"
    }
  }' | jq '.incident | {id, title, status}'
```

## List services

```bash
curl -s -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  "https://api.pagerduty.com/services?limit=20" | jq '.services[] | {id, name, status}'
```

## Who is on call?

```bash
curl -s -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  "https://api.pagerduty.com/oncalls?limit=10" | jq '.oncalls[] | {schedule: .schedule.summary, user: .user.summary, escalation_policy: .escalation_policy.summary}'
```

## List schedules

```bash
curl -s -H "Authorization: Token token=$PAGERDUTY_TOKEN" \
  "https://api.pagerduty.com/schedules" | jq '.schedules[] | {id, name, time_zone}'
```

## Notes

- Use `From` header with email for write operations if required by account settings.
- Confirm before acknowledging, resolving, or creating incidents.
