---
name: aws-dynamodb
description: "Query and manage AWS DynamoDB tables and items."
metadata: {"moltbot":{"emoji":"⚙️","requires":{"bins":["aws","jq"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# AWS DynamoDB

Query and manage DynamoDB tables.

## List tables

```bash
aws dynamodb list-tables --output table
```

## Describe table

```bash
aws dynamodb describe-table --table-name my-table | jq '{TableName: .Table.TableName, Status: .Table.TableStatus, ItemCount: .Table.ItemCount, SizeBytes: .Table.TableSizeBytes, KeySchema: .Table.KeySchema, BillingMode: .Table.BillingModeSummary.BillingMode}'
```

## Get item

```bash
aws dynamodb get-item --table-name my-table \
  --key '{"pk": {"S": "user#123"}, "sk": {"S": "profile"}}' | jq '.Item'
```

## Query items

```bash
aws dynamodb query --table-name my-table \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values '{":pk": {"S": "user#123"}}' \
  --query 'Items[*]' | jq .
```

## Query with filter

```bash
aws dynamodb query --table-name my-table \
  --key-condition-expression "pk = :pk AND begins_with(sk, :prefix)" \
  --expression-attribute-values '{":pk": {"S": "user#123"}, ":prefix": {"S": "order#"}}' \
  --query 'Items[*]' | jq .
```

## Scan table (use carefully)

```bash
aws dynamodb scan --table-name my-table --max-items 10 | jq '{Count, ScannedCount, Items: .Items[:3]}'
```

## Put item

```bash
aws dynamodb put-item --table-name my-table \
  --item '{"pk": {"S": "user#456"}, "sk": {"S": "profile"}, "name": {"S": "John"}, "email": {"S": "john@example.com"}}'
echo "Item written"
```

## Delete item

```bash
aws dynamodb delete-item --table-name my-table \
  --key '{"pk": {"S": "user#456"}, "sk": {"S": "profile"}}'
echo "Item deleted"
```

## Table metrics

```bash
aws cloudwatch get-metric-statistics --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits --dimensions Name=TableName,Value=my-table \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Sum --output table
```

## Notes

- Prefer `query` over `scan`; scans read every item and are expensive.
- DynamoDB uses typed attributes (`S` for string, `N` for number, `B` for binary, etc.).
- Confirm before writing or deleting items.
