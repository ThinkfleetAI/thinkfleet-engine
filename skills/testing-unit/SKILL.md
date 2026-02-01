---
name: testing-unit
description: "Unit testing across languages -- Jest, Vitest, pytest, Go test, Rust test, coverage, and watch mode."
metadata: {"thinkfleetbot":{"emoji":"🧪","requires":{"bins":["npx","node"]}}}
---

# Unit Testing

Run and manage unit tests across multiple languages and frameworks.

## Run Jest tests

```bash
# Run all Jest tests
npx jest

# Run specific test file
npx jest path/to/file.test.ts

# Run tests matching a pattern
npx jest --testPathPattern="auth"
npx jest -t "should authenticate user"

# Run in verbose mode
npx jest --verbose
```

## Run Vitest

```bash
# Run all Vitest tests
npx vitest run

# Run specific file
npx vitest run path/to/file.test.ts

# Run tests matching a filter
npx vitest run --reporter=verbose -t "login"

# Run with UI
npx vitest --ui
```

## Run pytest

```bash
# Run all tests
python -m pytest

# Run specific file or test
python -m pytest tests/test_auth.py
python -m pytest tests/test_auth.py::test_login -v

# Run tests matching keyword
python -m pytest -k "login or signup"

# Run with verbose output
python -m pytest -v --tb=short
```

## Run Go tests

```bash
# Run all tests
go test ./...

# Run specific package
go test ./pkg/auth/...

# Run specific test function
go test -run TestLogin ./pkg/auth/

# Verbose output
go test -v ./...
```

## Run Rust tests

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_login

# Run tests in specific module
cargo test --lib auth

# Show stdout from tests
cargo test -- --nocapture
```

## Generate test file

```bash
# Vitest: scaffold a test file (example)
# Create src/feature.test.ts with describe/it/expect blocks
# importing from vitest and the module under test

# Jest: scaffold a test file (example)
# Create src/feature.test.ts with describe/it/expect blocks
# importing the module under test
```

## Run with coverage

```bash
# Jest coverage
npx jest --coverage

# Vitest coverage
npx vitest run --coverage

# pytest coverage
python -m pytest --cov=src --cov-report=html

# Go coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Rust coverage (requires cargo-llvm-cov)
cargo llvm-cov --html
```

## Watch mode

```bash
# Jest watch
npx jest --watch

# Vitest watch (default mode)
npx vitest

# pytest watch (requires pytest-watch)
ptw -- -v

# Go watch (requires watchexec or similar)
watchexec -e go -- go test ./...
```
