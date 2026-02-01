---
name: cloudflare
description: "Manage Cloudflare — zones, DNS records, Workers, and analytics via the REST API."
metadata: {"moltbot":{"emoji":"🌐","requires":{"bins":["curl","jq"],"env":["CLOUDFLARE_API_TOKEN"]}}}
---

# Cloudflare

Manage zones, DNS records, Workers, and analytics.

## Environment Variables

- `CLOUDFLARE_API_TOKEN` - API token

## List zones

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?per_page=10" | jq '.result[] | {id, name, status}'
```

## List DNS records

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records" | jq '.result[] | {id, type, name, content, ttl}'
```

## Create DNS record

```bash
curl -s -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records" \
  -d '{"type":"A","name":"sub.example.com","content":"1.2.3.4","ttl":3600,"proxied":true}' | jq '.result | {id, name, content}'
```

## Purge cache

```bash
curl -s -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -d '{"purge_everything":true}' | jq '{success}'
```

## List Workers

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/workers/scripts" | jq '.result[] | {id, modified_on}'
```

## Notes

- Always confirm before modifying DNS or purging cache.
