---
name: azure-monitor
description: "Query Azure Monitor metrics, alerts, and Log Analytics workspaces."
metadata: {"moltbot":{"emoji":"📊","requires":{"bins":["az","jq"]}}}
---

# Azure Monitor

Query metrics, alerts, and logs.

## List alerts

```bash
az monitor metrics alert list --resource-group my-rg --query '[].{Name:name,Severity:severity,Enabled:enabled,Status:isEnabled}' -o table
```

## Get metric values

```bash
az monitor metrics list --resource /subscriptions/SUB_ID/resourceGroups/my-rg/providers/Microsoft.Web/sites/my-app \
  --metric "CpuTime" --interval PT1H --start-time $(date -u -d '6 hours ago' +%Y-%m-%dT%H:%M:%SZ) | jq '.value[0].timeseries[0].data[] | {time: .timeStamp, average}'
```

## List available metrics

```bash
az monitor metrics list-definitions --resource /subscriptions/SUB_ID/resourceGroups/my-rg/providers/Microsoft.Web/sites/my-app \
  --query '[].{Name:name.value,DisplayName:name.localizedValue,Unit:unit}' -o table | head -20
```

## Query Log Analytics

```bash
az monitor log-analytics query --workspace WORKSPACE_ID \
  --analytics-query "requests | where timestamp > ago(1h) | summarize count() by resultCode | order by count_ desc" | jq .
```

## List Log Analytics workspaces

```bash
az monitor log-analytics workspace list --query '[].{Name:name,ResourceGroup:resourceGroup,Sku:sku.name}' -o table
```

## List activity log (recent)

```bash
az monitor activity-log list --offset 1h --query '[].{Time:eventTimestamp,Operation:operationName.localizedValue,Status:status.localizedValue,Caller:caller}' -o table | head -20
```

## List action groups

```bash
az monitor action-group list --query '[].{Name:name,ResourceGroup:resourceGroup,Enabled:enabled}' -o table
```

## Notes

- Resource IDs are required for metric queries; get them from `az resource show`.
- Log Analytics uses KQL (Kusto Query Language).
- Confirm before creating or modifying alerts.
