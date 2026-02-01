---
name: code-quality
description: "Measure and improve code quality: linting, complexity analysis, coverage reports, tech debt tracking, and formatting enforcement."
metadata: {"thinkfleetbot":{"emoji":"📊","requires":{"anyBins":["eslint","ruff","golangci-lint","clippy"]}}}
---

# Code Quality

Measure, enforce, and improve code quality across languages.

## Linting

### JavaScript/TypeScript

```bash
# ESLint — find issues
npx eslint src/ --format json | jq '[.[] | select(.errorCount > 0 or .warningCount > 0) | {file: .filePath, errors: .errorCount, warnings: .warningCount}]'

# Auto-fix
npx eslint src/ --fix

# Specific rules only
npx eslint src/ --rule '{"no-unused-vars": "error"}'
```

### Python

```bash
# Ruff — fast linter + formatter
ruff check src/
ruff check src/ --fix

# Type checking
mypy src/ --ignore-missing-imports

# Both together
ruff check src/ && mypy src/
```

### Go

```bash
# golangci-lint — meta linter
golangci-lint run ./...

# With specific linters
golangci-lint run --enable gosec,govet,errcheck,staticcheck ./...

# JSON output
golangci-lint run --out-format json ./... | jq '.Issues[] | {file: .Pos.Filename, line: .Pos.Line, linter: .FromLinter, text: .Text}'
```

### Rust

```bash
# Clippy — Rust linter
cargo clippy -- -W clippy::all

# Treat warnings as errors
cargo clippy -- -D warnings

# With suggestions
cargo clippy --fix
```

## Formatting

```bash
# Prettier (JS/TS/CSS/JSON/MD)
npx prettier --check "src/**/*.{ts,tsx,js,jsx}"
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"

# Ruff format (Python)
ruff format src/
ruff format --check src/

# gofmt (Go)
gofmt -l .
gofmt -w .

# rustfmt (Rust)
cargo fmt --check
cargo fmt
```

## Code Coverage

```bash
# Jest (JS/TS)
npx jest --coverage --json | jq '{lines: .coverageMap | to_entries | map(.value.s | to_entries | map(.value) | {total: length, covered: map(select(. > 0)) | length}) | {total: map(.total) | add, covered: map(.covered) | add} | {pct: (100 * .covered / .total | floor)}}'

# Simpler: just run and read summary
npx jest --coverage 2>&1 | tail -10

# pytest (Python)
pytest --cov=src --cov-report=term-missing

# Go
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out | tail -1

# Rust
cargo tarpaulin --out stdout
```

## Complexity Metrics

```bash
# Python — cyclomatic complexity
radon cc src/ -a -s -nb

# Python — maintainability index
radon mi src/ -s -nb

# JavaScript/TypeScript — complexity via ESLint
npx eslint src/ --rule '{"complexity": ["warn", 10]}' --format json | jq '[.[] | .messages[] | select(.ruleId == "complexity") | {file: input.filePath, line: .line, message: .message}]'
```

## Tech Debt Indicators

Look for these patterns:

```bash
# TODO/FIXME/HACK comments
grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP" src/ --include="*.ts" --include="*.py" --include="*.go" | wc -l

# List them
grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.py"

# Long files (>300 lines)
find src/ -name "*.ts" -o -name "*.py" | xargs wc -l | sort -rn | head -20

# Duplicate code detection (Python)
# Install: pip install pylint
pylint --disable=all --enable=duplicate-code src/
```

## Notes

- Run linting on changed files only in CI for speed: `eslint $(git diff --name-only --diff-filter=ACMR HEAD~1 | grep -E '\.(ts|tsx|js)$')`.
- Coverage percentage alone is misleading — 80% with no edge case tests is worse than 60% with thorough tests.
- Fix linting errors incrementally. Don't dump 500 fixes into one commit.
- Complexity > 10 is a code smell. > 20 needs refactoring.
