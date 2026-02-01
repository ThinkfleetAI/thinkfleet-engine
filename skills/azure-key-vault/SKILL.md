---
name: azure-key-vault
description: "Manage Azure Key Vault secrets, keys, and certificates."
metadata: {"moltbot":{"emoji":"🔐","requires":{"bins":["az","jq"]}}}
---

# Azure Key Vault

Manage secrets, keys, and certificates.

## List vaults

```bash
az keyvault list --query '[].{Name:name,ResourceGroup:resourceGroup,Location:location}' -o table
```

## List secrets

```bash
az keyvault secret list --vault-name my-vault --query '[].{Name:name,Enabled:attributes.enabled,Updated:attributes.updated}' -o table
```

## Get secret value

```bash
az keyvault secret show --vault-name my-vault --name my-secret | jq '{name, value}'
```

## Set secret

```bash
az keyvault secret set --vault-name my-vault --name my-secret --value "s3cret-value" | jq '{name, id}'
```

## Delete secret

```bash
az keyvault secret delete --vault-name my-vault --name my-secret | jq '{name, recoveryId}'
```

## List keys

```bash
az keyvault key list --vault-name my-vault --query '[].{Name:name,KeyType:keyType,Enabled:attributes.enabled}' -o table
```

## List certificates

```bash
az keyvault certificate list --vault-name my-vault --query '[].{Name:name,Enabled:attributes.enabled,Expires:attributes.expires}' -o table
```

## Notes

- Key Vault uses soft-delete by default; deleted secrets can be recovered.
- Treat retrieved values as sensitive; avoid logging them.
- Confirm before creating, updating, or deleting secrets.
