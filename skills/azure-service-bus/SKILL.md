---
name: azure-service-bus
description: "Manage Azure Service Bus queues, topics, and subscriptions."
metadata: {"moltbot":{"emoji":"🚌","requires":{"bins":["az","jq"]}}}
---

# Azure Service Bus

Manage message queues and pub/sub topics.

## List namespaces

```bash
az servicebus namespace list --query '[].{Name:name,ResourceGroup:resourceGroup,Sku:sku.name,Location:location}' -o table
```

## List queues

```bash
az servicebus queue list --namespace-name my-sb --resource-group my-rg --query '[].{Name:name,Status:status,MessageCount:messageCount,DeadLetterCount:countDetails.deadLetterMessageCount}' -o table
```

## List topics

```bash
az servicebus topic list --namespace-name my-sb --resource-group my-rg --query '[].{Name:name,Status:status,Subscriptions:subscriptionCount}' -o table
```

## List subscriptions

```bash
az servicebus topic subscription list --namespace-name my-sb --resource-group my-rg --topic-name my-topic --query '[].{Name:name,Status:status,MessageCount:messageCount}' -o table
```

## Send message to queue

```bash
az servicebus queue send --namespace-name my-sb --resource-group my-rg --queue-name my-queue \
  --body '{"event":"deploy","status":"success"}'
echo "Message sent"
```

## Peek messages (queue)

```bash
az servicebus queue peek --namespace-name my-sb --resource-group my-rg --queue-name my-queue --max-count 5 | jq '.[] | {messageId, body}'
```

## Get connection string

```bash
az servicebus namespace authorization-rule keys list --namespace-name my-sb --resource-group my-rg \
  --authorization-rule-name RootManageSharedAccessKey --query 'primaryConnectionString' -o tsv
```

## Notes

- Peek reads messages without removing them; receive removes them.
- Confirm before sending messages or modifying queues/topics.
