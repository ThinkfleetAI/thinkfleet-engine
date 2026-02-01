---
name: dependency-audit
description: "Audit project dependencies for vulnerabilities, outdated packages, license compliance, and supply chain risks."
metadata: {"thinkfleetbot":{"emoji":"📦","requires":{"anyBins":["npm","pnpm","pip","cargo","go"]}}}
---

# Dependency Audit

Scan dependencies for vulnerabilities, check for outdated packages, and verify license compliance.

## Vulnerability Scanning

### Node.js (npm/pnpm)

```bash
# npm audit with summary
npm audit

# JSON output for processing
npm audit --json | jq '{total: .metadata.vulnerabilities, critical: .metadata.vulnerabilities.critical, high: .metadata.vulnerabilities.high}'

# Auto-fix where possible
npm audit fix

# pnpm
pnpm audit --json
```

### Python (pip-audit)

```bash
# Scan installed packages
pip-audit

# Scan from requirements file
pip-audit -r requirements.txt

# JSON output
pip-audit --format json -r requirements.txt

# Fix by upgrading
pip-audit --fix -r requirements.txt
```

### Go

```bash
# Check for known vulnerabilities
govulncheck ./...

# Verbose output with call stacks
govulncheck -show verbose ./...
```

### Rust

```bash
# Install cargo-audit if needed: cargo install cargo-audit
cargo audit

# JSON output
cargo audit --json
```

## Outdated Package Check

```bash
# Node.js
npm outdated --json | jq 'to_entries[] | {package: .key, current: .value.current, wanted: .value.wanted, latest: .value.latest}'

# pnpm
pnpm outdated --format json

# Python
pip list --outdated --format json | jq '.[] | {name, version, latest_version}'

# Go
go list -m -u all 2>/dev/null | grep '\['

# Rust
cargo outdated
```

## License Compliance

### Node.js

```bash
# Install: npm install -g license-checker
license-checker --json | jq 'to_entries[] | {package: .key, license: .value.licenses}' | head -100

# Check for specific problematic licenses
license-checker --failOn "GPL-3.0;AGPL-3.0" --json

# Summary by license type
license-checker --summary
```

### Python

```bash
# Install: pip install pip-licenses
pip-licenses --format json | jq '.[] | {name: .Name, license: .License}'

# Check for copyleft licenses
pip-licenses --allow-only "MIT;BSD-3-Clause;Apache-2.0;ISC"
```

## Dependency Tree

```bash
# Node.js — why is this package here?
npm explain <package-name>

# Full tree
npm ls --all --json | jq '.dependencies | keys'

# Python
pip show <package-name> | grep -E "^(Requires|Required-by)"

# Go
go mod graph | grep <module-name>

# Rust
cargo tree -p <crate-name>
```

## Supply Chain Checks

```bash
# Check package provenance (npm)
npm audit signatures

# Check for typosquatting — compare against known packages
npm info <suspicious-package> | head -5

# Check publish date and download counts
npm view <package-name> time --json | jq 'to_entries | sort_by(.value) | last(3)'
```

## Notes

- Run audits before merging dependency updates, not just on schedule.
- `npm audit fix --force` can introduce breaking changes — review before running.
- License compliance matters for commercial software. GPL/AGPL in dependencies can require open-sourcing your code.
- Zero-day vulnerabilities won't show in audits — keep dependencies minimal.
- Pin exact versions in production (`package-lock.json`, `requirements.txt` with `==`).
