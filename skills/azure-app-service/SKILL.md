---
name: azure-app-service
description: "Manage Azure App Service web apps, deployments, and configuration."
metadata: {"moltbot":{"emoji":"🌐","requires":{"bins":["az","jq"]}}}
---

# Azure App Service

Manage web apps and API apps.

## List web apps

```bash
az webapp list --query '[].{Name:name,ResourceGroup:resourceGroup,State:state,URL:defaultHostName}' -o table
```

## Show app details

```bash
az webapp show --name my-app --resource-group my-rg | jq '{name, state, defaultHostName, httpsOnly, kind}'
```

## View logs

```bash
az webapp log tail --name my-app --resource-group my-rg &
```

## Start / stop / restart

```bash
az webapp start --name my-app --resource-group my-rg
```

```bash
az webapp stop --name my-app --resource-group my-rg
```

```bash
az webapp restart --name my-app --resource-group my-rg
```

## List app settings

```bash
az webapp config appsettings list --name my-app --resource-group my-rg | jq '.[] | {name, value}'
```

## Set app settings

```bash
az webapp config appsettings set --name my-app --resource-group my-rg \
  --settings "KEY=value" | jq '.[].{name, value}'
```

## Deploy from zip

```bash
az webapp deploy --name my-app --resource-group my-rg --src-path /tmp/app.zip --type zip
```

## List deployment slots

```bash
az webapp deployment slot list --name my-app --resource-group my-rg --query '[].{Name:name,State:state}' -o table
```

## Swap slots

```bash
az webapp deployment slot swap --name my-app --resource-group my-rg --slot staging --target-slot production
```

## Notes

- Use deployment slots for zero-downtime deployments.
- Confirm before swapping slots, stopping, or modifying configuration.
