---
name: google-calendar
description: "Manage Google Calendar events via the Google Calendar API using curl + OAuth tokens."
metadata: {"thinkfleetbot":{"emoji":"📅","requires":{"bins":["curl","jq"],"env":["GOOGLE_ACCESS_TOKEN"]}}}
---

# Google Calendar

Interact with Google Calendar API.

## Environment Variables

- `GOOGLE_ACCESS_TOKEN` - OAuth2 access token with `calendar` scope

## List upcoming events

```bash
curl -s -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&timeMin=$(date -u +%Y-%m-%dT%H:%M:%SZ)&orderBy=startTime&singleEvents=true" \
  | jq '.items[] | {summary, start: .start.dateTime, end: .end.dateTime}'
```

## Create an event

```bash
curl -s -X POST \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://www.googleapis.com/calendar/v3/calendars/primary/events" \
  -d '{
    "summary": "Meeting with team",
    "start": {"dateTime": "2025-01-15T10:00:00-05:00"},
    "end": {"dateTime": "2025-01-15T11:00:00-05:00"}
  }' | jq '{id, summary, htmlLink}'
```

## Delete an event

```bash
curl -s -X DELETE \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  "https://www.googleapis.com/calendar/v3/calendars/primary/events/EVENT_ID"
```

## Notes

- Token refresh is handled externally (via SaaS credential store).
- Always confirm before creating/deleting events.
