---
name: terraform
description: "Manage infrastructure as code using Terraform CLI (init, plan, apply, state)."
metadata: {"moltbot":{"emoji":"🟣","requires":{"bins":["terraform"]}}}
---

# Terraform

Manage infrastructure as code using Terraform CLI.

## Initialize

```bash
cd /workspace/infra && terraform init
```

## Plan (preview changes)

```bash
cd /workspace/infra && terraform plan -no-color
```

## Plan with specific target

```bash
cd /workspace/infra && terraform plan -target=aws_instance.web -no-color
```

## Apply changes

```bash
cd /workspace/infra && terraform apply -auto-approve -no-color
```

## Destroy

```bash
cd /workspace/infra && terraform destroy -auto-approve -no-color
```

## Show state

```bash
cd /workspace/infra && terraform state list
```

```bash
cd /workspace/infra && terraform state show aws_instance.web
```

## Output values

```bash
cd /workspace/infra && terraform output -json | jq .
```

## Validate configuration

```bash
cd /workspace/infra && terraform validate -no-color
```

## Format check

```bash
cd /workspace/infra && terraform fmt -check -recursive -no-color
```

## Show providers

```bash
cd /workspace/infra && terraform providers
```

## Workspace management

```bash
terraform workspace list
```

```bash
terraform workspace select staging
```

## Import existing resource

```bash
cd /workspace/infra && terraform import aws_instance.web i-1234567890abcdef0
```

## Notes

- Always run `terraform plan` before `apply` to review changes.
- Use `-no-color` flag for clean output in non-terminal environments.
- Never run `terraform destroy` without explicit user confirmation.
- Use workspaces or separate state files for environment isolation.
- Backend configuration (S3, Azure Blob, GCS) should be set in terraform config, not CLI.
