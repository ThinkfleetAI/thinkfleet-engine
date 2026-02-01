---
name: azure-aks
description: "Manage Azure Kubernetes Service clusters via Azure CLI and kubectl."
metadata: {"thinkfleetbot":{"emoji":"☸️","requires":{"bins":["az","kubectl","jq"]}}}
---

# Azure AKS

Manage Azure Kubernetes Service clusters.

## List clusters

```bash
az aks list --query '[].{Name:name,ResourceGroup:resourceGroup,K8sVersion:kubernetesVersion,Nodes:agentPoolProfiles[0].count,Status:provisioningState}' -o table
```

## Get credentials (configure kubectl)

```bash
az aks get-credentials --name my-cluster --resource-group my-rg --overwrite-existing
echo "kubectl context configured"
```

## Show cluster details

```bash
az aks show --name my-cluster --resource-group my-rg | jq '{name, kubernetesVersion, provisioningState, fqdn, nodeResourceGroup, networkProfile: .networkProfile.networkPlugin}'
```

## List node pools

```bash
az aks nodepool list --cluster-name my-cluster --resource-group my-rg --query '[].{Name:name,VmSize:vmSize,Count:count,Mode:mode,OsType:osType}' -o table
```

## Scale node pool

```bash
az aks nodepool scale --cluster-name my-cluster --resource-group my-rg --name nodepool1 --node-count 5
```

## Upgrade cluster

```bash
az aks get-upgrades --name my-cluster --resource-group my-rg | jq '{currentVersion: .controlPlaneProfile.kubernetesVersion, upgrades: .controlPlaneProfile.upgrades[].kubernetesVersion}'
```

```bash
az aks upgrade --name my-cluster --resource-group my-rg --kubernetes-version 1.28.0
```

## Start / stop cluster

```bash
az aks start --name my-cluster --resource-group my-rg
```

```bash
az aks stop --name my-cluster --resource-group my-rg
```

## Notes

- After `get-credentials`, use `kubectl` for workload management.
- Confirm before scaling, upgrading, or stopping clusters.
