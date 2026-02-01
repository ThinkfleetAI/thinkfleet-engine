---
name: github-actions
description: "Manage GitHub Actions workflows -- trigger runs, view status, manage secrets, and debug failures."
metadata: {"moltbot":{"emoji":"🎬","requires":{"bins":["gh","jq"]},"env":["GITHUB_TOKEN"]}}}
---

# GitHub Actions

Manage CI/CD workflows via the GitHub CLI.

## Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token (or use `gh auth login`)

## List workflows

```bash
gh workflow list
```

## View workflow runs

```bash
gh run list --limit 10
```

## View run details

```bash
gh run view 12345678
```

## View run logs

```bash
gh run view 12345678 --log | tail -100
```

## View failed run logs

```bash
gh run view 12345678 --log-failed
```

## Trigger workflow dispatch

```bash
gh workflow run deploy.yml --ref main -f environment=staging -f version=1.2.3
```

## Re-run failed jobs

```bash
gh run rerun 12345678 --failed
```

## Cancel run

```bash
gh run cancel 12345678
```

## List workflow runs (filtered)

```bash
gh run list --workflow=ci.yml --status=failure --limit 5
```

## Watch run in progress

```bash
gh run watch 12345678
```

## Manage secrets

```bash
gh secret list
```

```bash
gh secret set MY_SECRET --body "secret-value"
```

```bash
gh secret delete MY_SECRET
```

## Manage variables

```bash
gh variable list
```

```bash
gh variable set MY_VAR --body "value"
```

## List environments

```bash
gh api repos/{owner}/{repo}/environments | jq '.environments[] | {name, protection_rules}'
```

## Download artifacts

```bash
gh run download 12345678 --dir /tmp/artifacts
```

## Workflow file reference

```bash
# Common workflow patterns:
# .github/workflows/ci.yml - Continuous integration
# .github/workflows/deploy.yml - Deployment
# .github/workflows/release.yml - Release automation
```

## Notes

- `gh` uses the current repo context; run from within a git repo or use `--repo owner/repo`.
- Workflow dispatch requires the workflow to define `workflow_dispatch` trigger.
- Confirm before triggering workflows, setting secrets, or cancelling runs.
