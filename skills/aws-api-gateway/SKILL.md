---
name: aws-api-gateway
description: "Manage AWS API Gateway REST and HTTP APIs."
metadata: {"moltbot":{"emoji":"🚪","requires":{"bins":["aws","jq"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# AWS API Gateway

Manage REST and HTTP APIs.

## List REST APIs

```bash
aws apigateway get-rest-apis --query 'items[].{Id:id,Name:name,Created:createdDate}' --output table
```

## List HTTP APIs (v2)

```bash
aws apigatewayv2 get-apis --query 'Items[].{Id:ApiId,Name:Name,Endpoint:ApiEndpoint,Protocol:ProtocolType}' --output table
```

## List resources (REST API)

```bash
aws apigateway get-resources --rest-api-id abc123 --query 'items[].{Id:id,Path:path,Methods:resourceMethods}' | jq .
```

## List stages

```bash
aws apigateway get-stages --rest-api-id abc123 --query 'item[].{Name:stageName,Deployed:deploymentId,Updated:lastUpdatedDate}' --output table
```

## List stages (HTTP API v2)

```bash
aws apigatewayv2 get-stages --api-id abc123 --query 'Items[].{Name:StageName,AutoDeploy:AutoDeploy}' --output table
```

## Create deployment

```bash
aws apigateway create-deployment --rest-api-id abc123 --stage-name prod \
  --description "Deploy from Moltbot" | jq '{Id: .id, CreatedDate: .createdDate}'
```

## Get usage plan

```bash
aws apigateway get-usage-plans --query 'items[].{Id:id,Name:name,Throttle:throttle,Quota:quota}' | jq .
```

## Notes

- REST API (v1) uses `apigateway`; HTTP API (v2) uses `apigatewayv2`.
- Confirm before creating deployments or modifying stages.
