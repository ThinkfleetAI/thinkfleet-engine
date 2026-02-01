---
name: microsoft-graph
description: "Interact with Microsoft 365 services (Teams, Outlook, OneDrive, Calendar) via the Microsoft Graph API."
metadata: {"thinkfleetbot":{"emoji":"Ⓜ️","requires":{"bins":["curl","jq"],"env":["MS_GRAPH_TOKEN"]}}}
---

# Microsoft Graph

Interact with Microsoft 365 services via the Graph API.

## Environment Variables

- `MS_GRAPH_TOKEN` - OAuth2 bearer token (delegated or application)

## My profile

```bash
curl -s -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/me" | jq '{displayName, mail, jobTitle}'
```

## List emails (Outlook)

```bash
curl -s -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/me/messages?\$top=10&\$select=subject,from,receivedDateTime,isRead" | jq '.value[] | {subject, from: .from.emailAddress.address, received: .receivedDateTime, isRead}'
```

## Send email (Outlook)

```bash
curl -s -X POST -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://graph.microsoft.com/v1.0/me/sendMail" \
  -d '{
    "message": {
      "subject": "Hello from ThinkFleetBot",
      "body": {"contentType": "Text", "content": "Message body here"},
      "toRecipients": [{"emailAddress": {"address": "recipient@example.com"}}]
    }
  }'
echo "Email sent"
```

## List calendar events

```bash
curl -s -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/me/events?\$top=10&\$select=subject,start,end,location&\$orderby=start/dateTime" | jq '.value[] | {subject, start: .start.dateTime, end: .end.dateTime, location: .location.displayName}'
```

## Create calendar event

```bash
curl -s -X POST -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://graph.microsoft.com/v1.0/me/events" \
  -d '{
    "subject": "Team Standup",
    "start": {"dateTime": "2025-01-15T09:00:00", "timeZone": "UTC"},
    "end": {"dateTime": "2025-01-15T09:30:00", "timeZone": "UTC"},
    "attendees": [{"emailAddress": {"address": "colleague@example.com"}, "type": "required"}]
  }' | jq '{id, subject, webLink}'
```

## Send Teams message

```bash
curl -s -X POST -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://graph.microsoft.com/v1.0/teams/TEAM_ID/channels/CHANNEL_ID/messages" \
  -d '{"body": {"content": "Hello from ThinkFleetBot!"}}' | jq '{id, createdDateTime}'
```

## List Teams channels

```bash
curl -s -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/me/joinedTeams" | jq '.value[] | {id, displayName}'
```

## List OneDrive files

```bash
curl -s -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/me/drive/root/children" | jq '.value[] | {name, size, lastModifiedDateTime, webUrl}'
```

## Upload file to OneDrive

```bash
curl -s -X PUT -H "Authorization: Bearer $MS_GRAPH_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @/tmp/report.pdf \
  "https://graph.microsoft.com/v1.0/me/drive/root:/Documents/report.pdf:/content" | jq '{name, webUrl}'
```

## Notes

- Tokens expire; use refresh tokens or app-only auth for long-running operations.
- Delegated tokens act on behalf of a user; application tokens act as the app.
- Use `$select`, `$filter`, `$top`, `$orderby` OData query params for efficient queries.
- Always confirm before sending emails, creating events, or posting messages.
