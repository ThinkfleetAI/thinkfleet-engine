---
name: google-analytics
description: "Query Google Analytics 4 — reports, realtime data, dimensions, and metrics via the Data API."
metadata: {"thinkfleetbot":{"emoji":"📈","requires":{"bins":["curl","jq"],"env":["GOOGLE_ACCESS_TOKEN"]}}}
---

# Google Analytics 4

Query reports, realtime data, and metrics via the GA4 Data API.

## Environment Variables

- `GOOGLE_ACCESS_TOKEN` - OAuth 2.0 access token with Analytics scope

## Run report

```bash
curl -s -X POST -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://analyticsdata.googleapis.com/v1beta/properties/PROPERTY_ID:runReport" \
  -d '{"dateRanges":[{"startDate":"7daysAgo","endDate":"today"}],"dimensions":[{"name":"pagePath"}],"metrics":[{"name":"activeUsers"},{"name":"screenPageViews"}],"limit":10}' | jq '.rows[] | {page: .dimensionValues[0].value, users: .metricValues[0].value, views: .metricValues[1].value}'
```

## Realtime report

```bash
curl -s -X POST -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://analyticsdata.googleapis.com/v1beta/properties/PROPERTY_ID:runRealtimeReport" \
  -d '{"dimensions":[{"name":"country"}],"metrics":[{"name":"activeUsers"}],"limit":10}' | jq '.rows[] | {country: .dimensionValues[0].value, users: .metricValues[0].value}'
```

## List properties

```bash
curl -s -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
  "https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/ACCOUNT_ID" | jq '.properties[] | {name, displayName}'
```

## Notes

- Replace `PROPERTY_ID` with your GA4 property ID (numeric).
- Access token must have `https://www.googleapis.com/auth/analytics.readonly` scope.
