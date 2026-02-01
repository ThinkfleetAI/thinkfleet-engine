---
name: aws-cloudfront
description: "Manage AWS CloudFront distributions and invalidations."
metadata: {"thinkfleetbot":{"emoji":"🌍","requires":{"bins":["aws","jq"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# AWS CloudFront

Manage CDN distributions and cache invalidations.

## List distributions

```bash
aws cloudfront list-distributions --query 'DistributionList.Items[].{Id:Id,Domain:DomainName,Status:Status,Origins:Origins.Items[0].DomainName}' --output table
```

## Get distribution details

```bash
aws cloudfront get-distribution --id E1234ABCDEF | jq '.Distribution | {Id, Status, DomainName, Origins: .DistributionConfig.Origins.Items[].DomainName, Aliases: .DistributionConfig.Aliases.Items}'
```

## Create invalidation

```bash
aws cloudfront create-invalidation --distribution-id E1234ABCDEF \
  --paths "/*" | jq '{Id: .Invalidation.Id, Status: .Invalidation.Status}'
```

## Create invalidation (specific paths)

```bash
aws cloudfront create-invalidation --distribution-id E1234ABCDEF \
  --paths "/index.html" "/css/*" "/js/*" | jq '{Id: .Invalidation.Id, Status: .Invalidation.Status}'
```

## List invalidations

```bash
aws cloudfront list-invalidations --distribution-id E1234ABCDEF --query 'InvalidationList.Items[].{Id:Id,Status:Status,Created:CreateTime}' --output table
```

## Get invalidation status

```bash
aws cloudfront get-invalidation --distribution-id E1234ABCDEF --id I1234567890 | jq '{Id: .Invalidation.Id, Status: .Invalidation.Status, Paths: .Invalidation.InvalidationBatch.Paths.Items}'
```

## Notes

- Invalidations take a few minutes to propagate globally.
- `/*` invalidates everything; use specific paths to reduce cost.
- First 1000 invalidation paths/month are free; excess is $0.005/path.
- Confirm before creating invalidations.
