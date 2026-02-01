---
name: azure-storage
description: "Manage Azure Blob Storage, file shares, queues, and tables."
metadata: {"moltbot":{"emoji":"☁️","requires":{"bins":["az","jq"]}}}
---

# Azure Storage

Manage Blob Storage, file shares, and storage accounts.

## List storage accounts

```bash
az storage account list --query '[].{Name:name,ResourceGroup:resourceGroup,Kind:kind,Sku:sku.name,Location:location}' -o table
```

## List blob containers

```bash
az storage container list --account-name mystorageacct --query '[].{Name:name,Access:properties.publicAccess}' -o table
```

## List blobs

```bash
az storage blob list --account-name mystorageacct --container-name mycontainer \
  --query '[].{Name:name,Size:properties.contentLength,Modified:properties.lastModified}' -o table | head -20
```

## Upload blob

```bash
az storage blob upload --account-name mystorageacct --container-name mycontainer \
  --file /tmp/report.pdf --name reports/report.pdf --overwrite
echo "Uploaded"
```

## Download blob

```bash
az storage blob download --account-name mystorageacct --container-name mycontainer \
  --name reports/report.pdf --file /tmp/downloaded.pdf
echo "Downloaded"
```

## Delete blob

```bash
az storage blob delete --account-name mystorageacct --container-name mycontainer --name reports/old.pdf
echo "Deleted"
```

## Generate SAS token

```bash
az storage blob generate-sas --account-name mystorageacct --container-name mycontainer \
  --name reports/report.pdf --permissions r --expiry $(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ) -o tsv
```

## Get account keys

```bash
az storage account keys list --account-name mystorageacct --query '[0].value' -o tsv
```

## Notes

- Use `--auth-mode login` for Azure AD auth instead of account keys.
- SAS tokens provide time-limited access to specific resources.
- Confirm before uploading, deleting, or modifying blobs.
