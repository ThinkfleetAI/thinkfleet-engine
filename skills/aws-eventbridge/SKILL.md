---
name: aws-eventbridge
description: "Manage AWS EventBridge rules, event buses, and targets."
metadata: {"thinkfleetbot":{"emoji":"🚌","requires":{"bins":["aws","jq"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# AWS EventBridge

Manage event-driven architectures with EventBridge.

## List rules

```bash
aws events list-rules --query 'Rules[].{Name:Name,State:State,Schedule:ScheduleExpression,Description:Description}' --output table
```

## Describe rule

```bash
aws events describe-rule --name my-rule | jq '{Name, State, ScheduleExpression, EventPattern}'
```

## List targets for rule

```bash
aws events list-targets-by-rule --rule my-rule --query 'Targets[].{Id:Id,Arn:Arn}' --output table
```

## Put event

```bash
aws events put-events --entries '[{
  "Source": "my.app",
  "DetailType": "OrderCreated",
  "Detail": "{\"orderId\":\"123\",\"amount\":99.99}",
  "EventBusName": "default"
}]' | jq '.Entries[] | {EventId}'
```

## Enable/disable rule

```bash
aws events enable-rule --name my-rule
echo "Rule enabled"
```

```bash
aws events disable-rule --name my-rule
echo "Rule disabled"
```

## List event buses

```bash
aws events list-event-buses --query 'EventBuses[].{Name:Name,Arn:Arn}' --output table
```

## Notes

- Event patterns and schedule expressions use different rule types.
- Schedule expressions use cron or rate syntax: `rate(5 minutes)` or `cron(0 12 * * ? *)`.
- Confirm before enabling/disabling rules or sending events.
