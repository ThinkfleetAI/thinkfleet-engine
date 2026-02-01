---
name: azure-functions
description: "Manage Azure Functions apps and invocations via Azure CLI."
metadata: {"moltbot":{"emoji":"⚡","requires":{"bins":["az","jq"]}}}
---

# Azure Functions

Manage serverless functions on Azure.

## List function apps

```bash
az functionapp list --query '[].{Name:name,ResourceGroup:resourceGroup,State:state,Runtime:siteConfig.linuxFxVersion}' -o table
```

## Get function app details

```bash
az functionapp show --name my-func-app --resource-group my-rg | jq '{name, state, defaultHostName, kind, httpsOnly}'
```

## List functions in app

```bash
az functionapp function list --name my-func-app --resource-group my-rg --query '[].{Name:name,Language:language}' -o table
```

## Get function URL (with key)

```bash
az functionapp function keys list --name my-func-app --resource-group my-rg --function-name MyFunction | jq '{default}'
```

## View logs (live stream)

```bash
az functionapp log tail --name my-func-app --resource-group my-rg &
```

## Start / stop / restart

```bash
az functionapp start --name my-func-app --resource-group my-rg
```

```bash
az functionapp stop --name my-func-app --resource-group my-rg
```

```bash
az functionapp restart --name my-func-app --resource-group my-rg
```

## Update app settings

```bash
az functionapp config appsettings set --name my-func-app --resource-group my-rg \
  --settings "KEY1=value1" "KEY2=value2" | jq '.[].{name, value}'
```

## Deploy zip package

```bash
az functionapp deployment source config-zip --name my-func-app --resource-group my-rg \
  --src /tmp/function.zip
```

## Notes

- Run `az login` first or set `AZURE_CONFIG_DIR` with service principal credentials.
- Confirm before deploying, stopping, or modifying settings.
