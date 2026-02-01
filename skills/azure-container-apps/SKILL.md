---
name: azure-container-apps
description: "Manage Azure Container Apps -- deploy, scale, and configure containerized applications."
metadata: {"thinkfleetbot":{"emoji":"📦","requires":{"bins":["az","jq"]}}}
---

# Azure Container Apps

Manage serverless containerized applications.

## List container apps

```bash
az containerapp list --query '[].{Name:name,ResourceGroup:resourceGroup,Status:provisioningState,FQDN:properties.configuration.ingress.fqdn}' -o table
```

## Show app details

```bash
az containerapp show --name my-app --resource-group my-rg | jq '{name, provisioningState, fqdn: .properties.configuration.ingress.fqdn, image: .properties.template.containers[0].image, replicas: .properties.template.scale}'
```

## View logs

```bash
az containerapp logs show --name my-app --resource-group my-rg --tail 50
```

## Update container image

```bash
az containerapp update --name my-app --resource-group my-rg \
  --image myregistry.azurecr.io/my-app:v2 | jq '{name, provisioningState}'
```

## Scale replicas

```bash
az containerapp update --name my-app --resource-group my-rg \
  --min-replicas 1 --max-replicas 10
```

## Set environment variables

```bash
az containerapp update --name my-app --resource-group my-rg \
  --set-env-vars "KEY=value" "DB_HOST=mydb.postgres.database.azure.com"
```

## List revisions

```bash
az containerapp revision list --name my-app --resource-group my-rg --query '[].{Name:name,Active:active,TrafficWeight:trafficWeight,Created:createdTime}' -o table
```

## Activate/deactivate revision

```bash
az containerapp revision activate --name my-app --resource-group my-rg --revision my-app--rev1
```

## Notes

- Container Apps auto-scale based on HTTP traffic, KEDA scalers, or CPU/memory.
- Use revisions for blue-green deployments.
- Confirm before updating images, scaling, or modifying configuration.
