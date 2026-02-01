---
name: google-gmail
description: "Read and send email via the Gmail API using curl + OAuth tokens."
metadata: {"thinkfleetbot":{"emoji":"✉️","requires":{"bins":["curl","jq","python3"],"env":["GOOGLE_ACCESS_TOKEN"]}}}
---

# Google Gmail

Read and send email via Gmail API.

## Environment Variables

- `GOOGLE_ACCESS_TOKEN` - OAuth2 access token with `gmail` scope

## List recent messages

```bash
curl -s -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5" \
  | jq '.messages[].id'
```

## Read a message

```bash
curl -s -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/MSG_ID?format=full" \
  | jq '{subject: (.payload.headers[] | select(.name=="Subject") | .value), from: (.payload.headers[] | select(.name=="From") | .value), snippet}'
```

## Send a message

```bash
python3 -c "
import base64, json
raw = 'From: me\r\nTo: recipient@example.com\r\nSubject: Hello\r\n\r\nBody text here'
encoded = base64.urlsafe_b64encode(raw.encode()).decode()
print(json.dumps({'raw': encoded}))
" | curl -s -X POST \
  -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- \
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send" \
  | jq '{id, threadId}'
```

## Search

```bash
curl -s -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:boss@example.com+is:unread&maxResults=5" \
  | jq '.messages[].id'
```

## Notes

- Always confirm recipient and content before sending.
- Token refresh is handled externally.
