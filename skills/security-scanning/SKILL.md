---
name: security-scanning
description: "Static analysis, dependency vulnerability scanning, secret detection, and container image scanning using open-source tools."
metadata: {"thinkfleetbot":{"emoji":"🛡️","requires":{"anyBins":["semgrep","trivy","trufflehog","snyk","grype"]}}}
---

# Security Scanning

Run static analysis, dependency audits, secret detection, and container scanning.

## Static Analysis (SAST)

### Semgrep — find code-level vulnerabilities

```bash
# Scan current directory with auto-detected rules
semgrep scan --config auto .

# Scan with OWASP top 10 rules
semgrep scan --config "p/owasp-top-ten" .

# Scan specific language
semgrep scan --config "p/python" src/

# Output as JSON for processing
semgrep scan --config auto --json . | jq '.results[] | {path: .path, line: .start.line, rule: .check_id, message: .extra.message}'

# Scan with severity filter
semgrep scan --config auto --severity ERROR .
```

## Dependency Vulnerability Scanning (SCA)

### Trivy — scan project dependencies

```bash
# Scan filesystem for vulnerable dependencies
trivy fs --severity HIGH,CRITICAL .

# Scan with JSON output
trivy fs --format json --output trivy-report.json .

# Scan specific lockfile
trivy fs --scanners vuln package-lock.json

# Scan and fail on critical (useful for CI)
trivy fs --exit-code 1 --severity CRITICAL .
```

### Snyk — dependency and code scanning

```bash
# Test dependencies for known vulnerabilities
snyk test

# Monitor project (registers with Snyk dashboard)
snyk monitor

# Test a specific manifest
snyk test --file=requirements.txt

# Code analysis
snyk code test

# Show dependency tree
snyk test --print-deps
```

### npm/pnpm audit (no extra tools needed)

```bash
# npm
npm audit --json | jq '.vulnerabilities | to_entries[] | {name: .key, severity: .value.severity, via: .value.via[0]}'

# pnpm
pnpm audit --json

# pip (Python)
pip audit --format json
```

## Secret Detection

### TruffleHog — find leaked credentials

```bash
# Scan git history for secrets
trufflehog git file://. --json | jq '{detector: .DetectorName, file: .SourceMetadata.Data.Git.file, line: .SourceMetadata.Data.Git.line}'

# Scan filesystem only (no git history)
trufflehog filesystem . --json

# Scan specific branch
trufflehog git file://. --branch main

# Scan since specific commit
trufflehog git file://. --since-commit abc123
```

## Container Image Scanning

### Trivy — scan Docker images

```bash
# Scan a local image
trivy image --severity HIGH,CRITICAL myapp:latest

# Scan with full report
trivy image --format json --output image-report.json myapp:latest

# Scan remote image
trivy image --severity CRITICAL nginx:latest
```

### Grype — image vulnerability scanner

```bash
# Scan local image
grype myapp:latest

# Scan with severity filter
grype myapp:latest --only-fixed --fail-on critical

# Scan from Dockerfile build context
grype dir:.

# JSON output
grype myapp:latest -o json | jq '.matches[] | {name: .vulnerability.id, severity: .vulnerability.severity, package: .artifact.name}'
```

## Quick Triage Workflow

1. **Secrets first** — `trufflehog git file://. --json` (most urgent, leaked creds = immediate risk)
2. **Dependencies** — `trivy fs --severity HIGH,CRITICAL .` (known CVEs in your supply chain)
3. **Code** — `semgrep scan --config auto .` (your own code vulnerabilities)
4. **Images** — `trivy image myapp:latest` (if containerized)

## Notes

- Always review findings before acting — false positives are common in SAST.
- Severity levels: CRITICAL > HIGH > MEDIUM > LOW > INFO. Focus on CRITICAL and HIGH first.
- For CI pipelines, use `--exit-code 1` (Trivy) or `--error` (Semgrep) to fail builds on findings.
- Secret detection in git history can be slow on large repos. Use `--since-commit` to limit scope.
- Run `snyk auth` before first use of Snyk CLI.
