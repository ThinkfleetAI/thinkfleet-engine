---
name: azure-cosmosdb
description: "Query and manage Azure Cosmos DB accounts, databases, and containers."
metadata: {"moltbot":{"emoji":"🌌","requires":{"bins":["az","jq"]}}}
---

# Azure Cosmos DB

Manage Cosmos DB databases and query data.

## List accounts

```bash
az cosmosdb list --query '[].{Name:name,ResourceGroup:resourceGroup,Kind:kind,Location:locations[0].locationName}' -o table
```

## List databases

```bash
az cosmosdb sql database list --account-name my-cosmos --resource-group my-rg --query '[].{Name:name}' -o table
```

## List containers

```bash
az cosmosdb sql container list --account-name my-cosmos --resource-group my-rg --database-name my-db --query '[].{Name:name,PartitionKey:resource.partitionKey.paths[0]}' -o table
```

## Query documents

```bash
az cosmosdb sql container query --account-name my-cosmos --resource-group my-rg \
  --database-name my-db --container-name my-container \
  --query-text "SELECT TOP 10 * FROM c WHERE c.status = 'active'" | jq '.[] | {id, status}'
```

## Get connection strings

```bash
az cosmosdb keys list --name my-cosmos --resource-group my-rg --type connection-strings | jq '.connectionStrings[0].connectionString'
```

## Get throughput

```bash
az cosmosdb sql container throughput show --account-name my-cosmos --resource-group my-rg \
  --database-name my-db --container-name my-container | jq '{throughput: .resource.throughput, autoscaleMax: .resource.autoscaleSettings.maxThroughput}'
```

## Update throughput

```bash
az cosmosdb sql container throughput update --account-name my-cosmos --resource-group my-rg \
  --database-name my-db --container-name my-container --throughput 1000
```

## Notes

- Cosmos DB supports SQL, MongoDB, Cassandra, Gremlin, and Table APIs.
- Use `az cosmosdb sql` for SQL API; replace `sql` with the API type for others.
- Confirm before modifying throughput (cost implications).
