---
name: aws-cloudwatch
description: "Query AWS CloudWatch metrics, alarms, and log groups."
metadata: {"moltbot":{"emoji":"📊","requires":{"bins":["aws","jq"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# AWS CloudWatch

Query metrics, alarms, and logs.

## List alarms

```bash
aws cloudwatch describe-alarms --state-value ALARM --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Metric:MetricName,Reason:StateReason}' --output table
```

## List all alarms

```bash
aws cloudwatch describe-alarms --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Metric:MetricName,Namespace:Namespace}' --output table
```

## Get metric data

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-1234567890abcdef0 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Average --output table
```

## List log groups

```bash
aws logs describe-log-groups --query 'logGroups[].{Name:logGroupName,Stored:storedBytes,Retention:retentionInDays}' --output table | head -30
```

## Tail logs

```bash
aws logs tail /aws/lambda/my-function --since 1h --format short
```

## Search logs (filter pattern)

```bash
aws logs filter-log-events --log-group-name /aws/lambda/my-function \
  --filter-pattern "ERROR" --start-time $(date -d '1 hour ago' +%s000) \
  --query 'events[].{Time:timestamp,Message:message}' --output table | head -30
```

## List dashboards

```bash
aws cloudwatch list-dashboards --query 'DashboardEntries[].{Name:DashboardName,Size:Size,Modified:LastModified}' --output table
```

## Put metric alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "HighCPU" --metric-name CPUUtilization \
  --namespace AWS/EC2 --statistic Average --period 300 \
  --threshold 80 --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=InstanceId,Value=i-1234567890abcdef0
echo "Alarm created"
```

## Notes

- Use `aws logs tail --follow` for real-time log streaming.
- `date -d` syntax is Linux; macOS uses `date -v-1H` instead.
- Confirm before creating or modifying alarms.
