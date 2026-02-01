---
name: aws-route53
description: "Manage AWS Route 53 DNS zones and records."
metadata: {"moltbot":{"emoji":"🌐","requires":{"bins":["aws","jq"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# AWS Route 53

Manage DNS hosted zones and records.

## List hosted zones

```bash
aws route53 list-hosted-zones --query 'HostedZones[].{Id:Id,Name:Name,Records:ResourceRecordSetCount,Private:Config.PrivateZone}' --output table
```

## List records

```bash
aws route53 list-resource-record-sets --hosted-zone-id Z1234ABCDEF \
  --query 'ResourceRecordSets[].{Name:Name,Type:Type,TTL:TTL,Values:ResourceRecords[].Value}' | jq .
```

## Create/update A record

```bash
aws route53 change-resource-record-sets --hosted-zone-id Z1234ABCDEF \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "app.example.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "1.2.3.4"}]
      }
    }]
  }' | jq '{ChangeId: .ChangeInfo.Id, Status: .ChangeInfo.Status}'
```

## Create CNAME record

```bash
aws route53 change-resource-record-sets --hosted-zone-id Z1234ABCDEF \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "app.example.com"}]
      }
    }]
  }' | jq '{ChangeId: .ChangeInfo.Id, Status: .ChangeInfo.Status}'
```

## Check change status

```bash
aws route53 get-change --id /change/C1234567890 | jq '{Status: .ChangeInfo.Status}'
```

## Notes

- DNS changes are eventual; may take 60s to propagate.
- Use `UPSERT` to create or update a record in one call.
- Hosted zone IDs start with `Z` or `/hostedzone/Z`.
- Always confirm before modifying DNS records.
