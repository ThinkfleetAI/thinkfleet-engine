---
name: salesforce
description: "Query and manage Salesforce CRM — accounts, contacts, leads, opportunities, and cases via the REST API."
metadata: {"moltbot":{"emoji":"☁️","requires":{"bins":["curl","jq"],"env":["SALESFORCE_INSTANCE_URL","SALESFORCE_ACCESS_TOKEN"]}}}
---

# Salesforce

Query and manage CRM data via the Salesforce REST API.

## Environment Variables

- `SALESFORCE_INSTANCE_URL` - Instance URL (e.g. `https://myorg.my.salesforce.com`)
- `SALESFORCE_ACCESS_TOKEN` - OAuth access token

## Query records (SOQL)

```bash
curl -s -H "Authorization: Bearer $SALESFORCE_ACCESS_TOKEN" \
  "$SALESFORCE_INSTANCE_URL/services/data/v59.0/query?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('SELECT Id, Name, Industry FROM Account LIMIT 10'))")" | jq '.records[] | {Id, Name, Industry}'
```

## Get account

```bash
curl -s -H "Authorization: Bearer $SALESFORCE_ACCESS_TOKEN" \
  "$SALESFORCE_INSTANCE_URL/services/data/v59.0/sobjects/Account/ACCOUNT_ID" | jq '{Id, Name, Industry, Phone, Website}'
```

## Create lead

```bash
curl -s -X POST -H "Authorization: Bearer $SALESFORCE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "$SALESFORCE_INSTANCE_URL/services/data/v59.0/sobjects/Lead" \
  -d '{"FirstName":"John","LastName":"Doe","Company":"Acme","Email":"john@acme.com"}' | jq '{id, success}'
```

## List opportunities

```bash
curl -s -H "Authorization: Bearer $SALESFORCE_ACCESS_TOKEN" \
  "$SALESFORCE_INSTANCE_URL/services/data/v59.0/query?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT 10'))")" | jq '.records[] | {Id, Name, StageName, Amount}'
```

## Update record

```bash
curl -s -X PATCH -H "Authorization: Bearer $SALESFORCE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "$SALESFORCE_INSTANCE_URL/services/data/v59.0/sobjects/Account/ACCOUNT_ID" \
  -d '{"Phone":"555-1234"}'
```

## Notes

- API version v59.0 used; update as needed.
- Always confirm before creating or updating records.
