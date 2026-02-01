---
name: performance-testing
description: "Load testing with k6, web performance auditing with Lighthouse, profiling, and benchmark analysis."
metadata: {"moltbot":{"emoji":"⚡","requires":{"anyBins":["k6","lighthouse","curl"]}}}
---

# Performance Testing

Load testing, web performance auditing, profiling, and benchmarking.

## Load Testing with k6

### Quick smoke test

```bash
k6 run --vus 1 --duration 10s script.js
```

### Stress test

```bash
k6 run --vus 100 --duration 5m script.js
```

### Inline script (no file needed)

```bash
k6 run -e URL=https://api.example.com - <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(__ENV.URL);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
EOF
```

### k6 with JSON output

```bash
k6 run --out json=results.json script.js
cat results.json | jq 'select(.type=="Point" and .metric=="http_req_duration") | .data.value' | sort -n | tail -5
```

## Web Performance (Lighthouse)

### CLI audit

```bash
# Full audit
lighthouse https://example.com --output json --output html --output-path ./report

# Performance only
lighthouse https://example.com --only-categories=performance --output json | jq '{performance: .categories.performance.score, fcp: .audits["first-contentful-paint"].displayValue, lcp: .audits["largest-contentful-paint"].displayValue, cls: .audits["cumulative-layout-shift"].displayValue, tbt: .audits["total-blocking-time"].displayValue}'

# Mobile simulation (default)
lighthouse https://example.com --preset=perf --output json | jq '.categories.performance.score'

# Desktop
lighthouse https://example.com --preset=desktop --output json | jq '.categories.performance.score'
```

### Core Web Vitals extraction

```bash
lighthouse https://example.com --output json | jq '{
  LCP: .audits["largest-contentful-paint"].numericValue,
  FID: .audits["max-potential-fid"].numericValue,
  CLS: .audits["cumulative-layout-shift"].numericValue,
  FCP: .audits["first-contentful-paint"].numericValue,
  TBT: .audits["total-blocking-time"].numericValue,
  SI: .audits["speed-index"].numericValue
}'
```

## HTTP Benchmarking

### curl timing

```bash
# Detailed timing for single request
curl -s -o /dev/null -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\nSize: %{size_download} bytes\n" https://example.com

# Repeated measurements
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{time_total}" https://example.com
  echo ""
done | awk '{sum+=$1; count++} END {print "Avg: " sum/count "s over " count " requests"}'
```

### Apache Bench (ab)

```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 https://example.com/

# With POST data
ab -n 100 -c 10 -p payload.json -T application/json https://api.example.com/endpoint
```

## Bundle Size Analysis

```bash
# Node.js bundle (webpack)
npx webpack --profile --json > stats.json
npx webpack-bundle-analyzer stats.json

# Vite
npx vite build --report

# Package size check
npx bundlephobia <package-name>

# Check what you're shipping
du -sh dist/
find dist/ -name "*.js" -exec du -sh {} \; | sort -rh | head -10
```

## Memory & CPU Profiling

```bash
# Node.js heap snapshot
node --inspect app.js
# Then open chrome://inspect in Chrome

# Node.js CPU profile
node --cpu-prof app.js
# Generates .cpuprofile file — open in Chrome DevTools

# Python profiling
python -m cProfile -s cumulative app.py | head -30

# Go profiling
go test -bench=. -cpuprofile=cpu.prof -memprofile=mem.prof
go tool pprof cpu.prof
```

## Notes

- k6 `p(95)<500` means 95th percentile response time under 500ms — a good baseline.
- Lighthouse scores vary between runs. Run 3-5 times and average.
- Always load test against staging, not production, unless you have explicit approval.
- Bundle size directly impacts page load. Track it in CI.
- Profile in production-like environments — dev mode adds overhead that skews results.
