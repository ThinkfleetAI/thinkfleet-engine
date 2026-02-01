---
name: aws-secrets-manager
description: "Manage AWS Secrets Manager secrets -- retrieve, create, and rotate."
metadata: {"moltbot":{"emoji":"🔑","requires":{"bins":["aws","jq"],"env":["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]}}}
---

# AWS Secrets Manager

Manage application secrets.

## List secrets

```bash
aws secretsmanager list-secrets --query 'SecretList[].{Name:Name,Description:Description,LastChanged:LastChangedDate,RotationEnabled:RotationEnabled}' --output table
```

## Get secret value

```bash
aws secretsmanager get-secret-value --secret-id my-secret | jq '{Name: .Name, Value: .SecretString}'
```

## Get secret (JSON parsed)

```bash
aws secretsmanager get-secret-value --secret-id my-secret --query 'SecretString' --output text | jq .
```

## Create secret

```bash
aws secretsmanager create-secret --name my-new-secret \
  --secret-string '{"username":"admin","password":"s3cret"}' | jq '{ARN, Name, VersionId}'
```

## Update secret

```bash
aws secretsmanager put-secret-value --secret-id my-secret \
  --secret-string '{"username":"admin","password":"n3wpass"}' | jq '{ARN, Name, VersionId}'
```

## Describe secret

```bash
aws secretsmanager describe-secret --secret-id my-secret | jq '{Name, Description, RotationEnabled, LastRotatedDate, Tags}'
```

## Rotate secret

```bash
aws secretsmanager rotate-secret --secret-id my-secret | jq '{ARN, Name, VersionId}'
```

## Delete secret

```bash
aws secretsmanager delete-secret --secret-id my-secret --recovery-window-in-days 7 | jq '{Name, DeletionDate}'
```

## Notes

- Secrets have a recovery window (7-30 days) after deletion; use `--force-delete-without-recovery` to skip.
- Secret values may be plain strings or JSON.
- Always confirm before creating, updating, or deleting secrets.
- Treat retrieved values as sensitive; avoid logging them.
