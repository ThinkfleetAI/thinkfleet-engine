---
name: azure-devops
description: "Manage Azure DevOps work items, pipelines, and repos via the REST API."
metadata: {"thinkfleetbot":{"emoji":"🔷","requires":{"bins":["curl","jq"],"env":["AZDO_ORG_URL","AZDO_PAT"]}}}
---

# Azure DevOps

Manage work items, pipelines, and repos via the Azure DevOps REST API.

## Environment Variables

- `AZDO_ORG_URL` - Organization URL (e.g. `https://dev.azure.com/yourorg`)
- `AZDO_PAT` - Personal access token
- `AZDO_PROJECT` - Default project name (optional)

## Auth header

```bash
AZDO_AUTH=$(echo -n ":$AZDO_PAT" | base64)
```

## List projects

```bash
curl -s -H "Authorization: Basic $(echo -n ":$AZDO_PAT" | base64)" \
  "$AZDO_ORG_URL/_apis/projects?api-version=7.1" | jq '.value[] | {name, state}'
```

## Get work item

```bash
curl -s -H "Authorization: Basic $(echo -n ":$AZDO_PAT" | base64)" \
  "$AZDO_ORG_URL/$AZDO_PROJECT/_apis/wit/workitems/123?api-version=7.1" | jq '{id, title: .fields["System.Title"], state: .fields["System.State"], assignedTo: .fields["System.AssignedTo"].displayName}'
```

## Create work item

```bash
curl -s -X POST -H "Authorization: Basic $(echo -n ":$AZDO_PAT" | base64)" \
  -H "Content-Type: application/json-patch+json" \
  "$AZDO_ORG_URL/$AZDO_PROJECT/_apis/wit/workitems/\$Bug?api-version=7.1" \
  -d '[
    {"op": "add", "path": "/fields/System.Title", "value": "Login page broken"},
    {"op": "add", "path": "/fields/System.Description", "value": "Description here"}
  ]' | jq '{id, url}'
```

## Query work items (WIQL)

```bash
curl -s -X POST -H "Authorization: Basic $(echo -n ":$AZDO_PAT" | base64)" \
  -H "Content-Type: application/json" \
  "$AZDO_ORG_URL/$AZDO_PROJECT/_apis/wit/wiql?api-version=7.1" \
  -d '{"query": "SELECT [System.Id],[System.Title],[System.State] FROM WorkItems WHERE [System.State] = '\''Active'\'' ORDER BY [System.ChangedDate] DESC"}' | jq '.workItems[] | {id, url}'
```

## List pipelines

```bash
curl -s -H "Authorization: Basic $(echo -n ":$AZDO_PAT" | base64)" \
  "$AZDO_ORG_URL/$AZDO_PROJECT/_apis/pipelines?api-version=7.1" | jq '.value[] | {id, name}'
```

## Run pipeline

```bash
curl -s -X POST -H "Authorization: Basic $(echo -n ":$AZDO_PAT" | base64)" \
  -H "Content-Type: application/json" \
  "$AZDO_ORG_URL/$AZDO_PROJECT/_apis/pipelines/123/runs?api-version=7.1" \
  -d '{"resources": {"repositories": {"self": {"refName": "refs/heads/main"}}}}' | jq '{id: .id, state: .state}'
```

## List repos

```bash
curl -s -H "Authorization: Basic $(echo -n ":$AZDO_PAT" | base64)" \
  "$AZDO_ORG_URL/$AZDO_PROJECT/_apis/git/repositories?api-version=7.1" | jq '.value[] | {name, defaultBranch, webUrl}'
```

## Notes

- Use API version `7.1` for latest features.
- PATs can be scoped to specific permissions (work items, code, build, etc.).
- Work item type names in URLs must be prefixed with `$` (e.g. `$Bug`, `$Task`).
- Always confirm before creating work items or running pipelines.
