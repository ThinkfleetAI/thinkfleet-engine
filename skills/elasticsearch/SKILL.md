---
name: elasticsearch
description: "Query Elasticsearch — search, index management, aggregations, and cluster health."
metadata: {"moltbot":{"emoji":"🔍","requires":{"bins":["curl","jq"],"env":["ELASTICSEARCH_URL"]}}}
---

# Elasticsearch

Search, manage indexes, and run aggregations.

## Environment Variables

- `ELASTICSEARCH_URL` - Elasticsearch URL (e.g. `https://localhost:9200`)

## Cluster health

```bash
curl -s "$ELASTICSEARCH_URL/_cluster/health" | jq '{status, number_of_nodes, active_shards}'
```

## List indexes

```bash
curl -s "$ELASTICSEARCH_URL/_cat/indices?format=json&h=index,docs.count,store.size,health" | jq '.[]'
```

## Search

```bash
curl -s -X POST -H "Content-Type: application/json" \
  "$ELASTICSEARCH_URL/INDEX_NAME/_search" \
  -d '{"query":{"match":{"field":"search term"}},"size":10}' | jq '.hits.hits[] | {_id, _source}'
```

## Index document

```bash
curl -s -X POST -H "Content-Type: application/json" \
  "$ELASTICSEARCH_URL/INDEX_NAME/_doc" \
  -d '{"field":"value"}' | jq '{_id, result}'
```

## Notes

- Always confirm before indexing or deleting documents.
