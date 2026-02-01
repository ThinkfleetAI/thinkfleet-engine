---
name: mailchimp
description: "Manage Mailchimp — lists, campaigns, subscribers, and templates via the Marketing API."
metadata: {"moltbot":{"emoji":"📧","requires":{"bins":["curl","jq"],"env":["MAILCHIMP_API_KEY","MAILCHIMP_SERVER_PREFIX"]}}}
---

# Mailchimp

Manage lists, campaigns, and subscribers via the Mailchimp Marketing API.

## Environment Variables

- `MAILCHIMP_API_KEY` - API key
- `MAILCHIMP_SERVER_PREFIX` - Server prefix (e.g. `us21`)

## List audiences

```bash
curl -s -u "anystring:$MAILCHIMP_API_KEY" \
  "https://$MAILCHIMP_SERVER_PREFIX.api.mailchimp.com/3.0/lists?count=10" | jq '.lists[] | {id, name, stats: {member_count: .stats.member_count, open_rate: .stats.open_rate}}'
```

## List campaigns

```bash
curl -s -u "anystring:$MAILCHIMP_API_KEY" \
  "https://$MAILCHIMP_SERVER_PREFIX.api.mailchimp.com/3.0/campaigns?count=10" | jq '.campaigns[] | {id, type, status, settings: .settings.subject_line}'
```

## Add subscriber

```bash
curl -s -X POST -u "anystring:$MAILCHIMP_API_KEY" \
  -H "Content-Type: application/json" \
  "https://$MAILCHIMP_SERVER_PREFIX.api.mailchimp.com/3.0/lists/LIST_ID/members" \
  -d '{"email_address":"user@example.com","status":"subscribed","merge_fields":{"FNAME":"John","LNAME":"Doe"}}' | jq '{id, email_address, status}'
```

## Get campaign report

```bash
curl -s -u "anystring:$MAILCHIMP_API_KEY" \
  "https://$MAILCHIMP_SERVER_PREFIX.api.mailchimp.com/3.0/reports/CAMPAIGN_ID" | jq '{emails_sent, opens: {open_rate: .opens.open_rate, unique_opens: .opens.unique_opens}, clicks: {click_rate: .clicks.click_rate}}'
```

## Notes

- Always confirm before sending campaigns or adding subscribers.
