---
name: testing-e2e
description: "End-to-end testing -- Playwright E2E suites, Cypress E2E, API testing with supertest, load testing with k6, and test reporting."
metadata: {"thinkfleetbot":{"emoji":"🔬","requires":{"bins":["npx","node"]}}}
---

# End-to-End Testing

Full E2E test suites, API testing, load testing, and report generation.

## Run Playwright E2E suite

```bash
# Run full E2E suite
npx playwright test --config=playwright.config.ts

# Run E2E tests with retries
npx playwright test --retries=2

# Run E2E in CI mode (all browsers, parallel)
npx playwright test --reporter=html --workers=4

# Run tagged E2E tests
npx playwright test --grep="@smoke"
npx playwright test --grep="@critical"

# Trace on failure for debugging
npx playwright test --trace=on-first-retry
npx playwright show-trace test-results/trace.zip
```

## Run Cypress E2E

```bash
# Run all E2E specs
npx cypress run --e2e

# Run specific E2E spec
npx cypress run --spec "cypress/e2e/checkout.cy.ts"

# Run with video recording
npx cypress run --e2e --record

# Run in a specific browser
npx cypress run --e2e --browser electron

# Run with environment variables
npx cypress run --e2e --env BASE_URL=http://localhost:3000
```

## API testing with supertest

```bash
# Run API tests (typically Jest or Vitest)
npx jest tests/api/
npx vitest run tests/api/

# Scaffold an API test (example)
# Create tests/api/health.test.ts with supertest
# importing app and using request(app).get("/health")
```

## Load testing with k6

```bash
# Run a k6 load test (requires k6 installed)
k6 run load-tests/smoke.js

# Run with custom VUs and duration
k6 run --vus 50 --duration 30s load-tests/stress.js

# Run with thresholds
k6 run --out json=results.json load-tests/spike.js

# Scaffold a k6 script (example)
# Create load-tests/smoke.js with k6/http import
# Define options: vus, duration, thresholds
# Export default function with http.get and check
```

## Test report generation

```bash
# Playwright HTML report
npx playwright test --reporter=html
npx playwright show-report

# Playwright JSON report
npx playwright test --reporter=json > test-results.json

# Playwright JUnit report (for CI)
npx playwright test --reporter=junit > junit-results.xml

# Cypress reports with mochawesome
npx cypress run --reporter mochawesome --reporter-options reportDir=reports,overwrite=false,html=true

# Merge multiple mochawesome reports
npx mochawesome-merge reports/*.json > merged-report.json
npx marge merged-report.json --reportDir=reports --inline

# Jest HTML report (requires jest-html-reporter)
npx jest --reporters=default --reporters=jest-html-reporter
```
