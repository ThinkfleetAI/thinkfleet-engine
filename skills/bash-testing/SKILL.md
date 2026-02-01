---
name: bash-testing
description: "Test shell scripts with BATS (Bash Automated Testing System). Write, run, and debug tests for bash scripts."
metadata: {"thinkfleetbot":{"emoji":"🐚","requires":{"bins":["bats"]},"install":[{"kind":"brew","formula":"bats-core","bins":["bats"],"label":"BATS Core"}]}}
---

# Bash Testing (BATS)

Test shell scripts reliably with the Bash Automated Testing System.

## Run tests

```bash
# Run a test file
bats test/my_script.bats

# Run all tests in directory
bats test/

# Verbose output
bats --verbose-run test/

# TAP format output (for CI)
bats --formatter tap test/

# Pretty output
bats --formatter pretty test/
```

## Write a test

```bash
# test/example.bats
#!/usr/bin/env bats

setup() {
  # Runs before each test
  source ./my_script.sh
}

teardown() {
  # Runs after each test
  rm -f /tmp/test_output
}

@test "function returns expected output" {
  result=$(my_function "input")
  [ "$result" = "expected output" ]
}

@test "script exits with code 0 on success" {
  run ./my_script.sh --valid-arg
  [ "$status" -eq 0 ]
}

@test "script exits with code 1 on bad input" {
  run ./my_script.sh --invalid
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Error" ]]
}

@test "output contains expected string" {
  run ./my_script.sh
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Success" ]]
}

@test "file is created" {
  run ./my_script.sh --create /tmp/test_output
  [ "$status" -eq 0 ]
  [ -f /tmp/test_output ]
}
```

## Key assertions

```bash
# Exit status
[ "$status" -eq 0 ]

# Exact output match
[ "$output" = "expected" ]

# Regex match
[[ "$output" =~ "pattern" ]]

# Line-specific output
[ "${lines[0]}" = "first line" ]
[ "${lines[1]}" = "second line" ]

# File exists
[ -f "$filepath" ]

# String not empty
[ -n "$result" ]

# Numeric comparison
[ "$count" -gt 5 ]
```

## Using helper libraries

```bash
# With bats-support and bats-assert (install separately)
setup() {
  load 'test_helper/bats-support/load'
  load 'test_helper/bats-assert/load'
}

@test "readable assertions" {
  run ./my_script.sh
  assert_success
  assert_output --partial "expected text"
  refute_output --partial "error"
  assert_line --index 0 "first line"
}
```

## Notes

- Install helpers: `git clone https://github.com/bats-core/bats-support test/test_helper/bats-support` and `git clone https://github.com/bats-core/bats-assert test/test_helper/bats-assert`.
- Use `setup_file()` / `teardown_file()` for expensive one-time setup.
- The `run` keyword captures both stdout and exit status into `$output` and `$status`.
- Tests run in subshells — variable changes don't leak between tests.
