---
name: debugging-strategies
description: "Systematic debugging: stack trace analysis, log-based diagnosis, bisecting regressions, memory leak detection, and profiling."
metadata: {"moltbot":{"emoji":"🐛","requires":{"anyBins":["git","node","python3"]}}}
---

# Debugging Strategies

Systematic approaches to finding and fixing bugs.

## Stack Trace Analysis

### Read the trace bottom-up
The bottom of a stack trace is the most recent call — start there.

```bash
# Node.js — get full stack traces
NODE_OPTIONS="--stack-trace-limit=50" node app.js

# Python — verbose traceback
python3 -u -X tracemalloc app.py
```

### Common patterns
- **TypeError: Cannot read property of undefined** → Check the object one level up in the chain
- **ECONNREFUSED** → Service isn't running or wrong port
- **ENOMEM** → Memory exhaustion, check for leaks
- **Segfault** → Native addon or buffer overflow

## Log-Based Debugging

```bash
# Tail logs with filtering
tail -f app.log | grep -E "ERROR|WARN"

# Search recent logs for pattern
grep -n "error" app.log | tail -20

# Correlate by request ID
grep "req-abc123" app.log

# Docker container logs
docker logs --since 5m --follow myapp 2>&1 | grep -i error

# Kubernetes pod logs
kubectl logs -l app=myapp --since=10m | grep -i "exception\|error\|fatal"

# Multiple pods
kubectl logs -l app=myapp --all-containers --prefix --since=5m
```

## Git Bisect (Find the Breaking Commit)

```bash
# Start bisect
git bisect start

# Mark current as bad
git bisect bad

# Mark known good commit
git bisect good v1.0.0

# Test each commit git checks out, then mark:
git bisect good  # or
git bisect bad

# Automate with a test script
git bisect run npm test

# When done
git bisect reset

# View bisect log
git bisect log
```

## Memory Leak Detection

### Node.js

```bash
# Heap snapshot
node --inspect app.js
# Open chrome://inspect → Take heap snapshot → Compare snapshots

# Track memory over time
node -e "
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(JSON.stringify({
    rss: (mem.rss / 1024 / 1024).toFixed(1) + 'MB',
    heap: (mem.heapUsed / 1024 / 1024).toFixed(1) + 'MB',
    external: (mem.external / 1024 / 1024).toFixed(1) + 'MB'
  }));
}, 5000);
require('./app.js');
"

# Generate heap dump on OOM
node --max-old-space-size=512 --heap-prof app.js
```

### Python

```bash
# Track object counts
python3 -c "
import tracemalloc
tracemalloc.start()
# ... run code ...
snapshot = tracemalloc.take_snapshot()
for stat in snapshot.statistics('lineno')[:10]:
    print(stat)
"

# objgraph for reference cycles
python3 -c "
import objgraph
objgraph.show_most_common_types(limit=10)
"
```

## Network Debugging

```bash
# DNS resolution
dig example.com +short
nslookup example.com

# Port check
nc -zv localhost 3000

# HTTP timing
curl -s -o /dev/null -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://example.com

# Watch connections
lsof -i :3000
netstat -an | grep 3000
```

## Reproduce and Isolate

```bash
# Minimal reproduction
# 1. Create minimal test case
# 2. Remove code until bug disappears
# 3. Last removal is the culprit

# Environment comparison
node --version && npm --version && echo "OS: $(uname -s)"
env | grep -iE "node|npm|path|home" | sort

# Check for race conditions — run multiple times
for i in $(seq 1 10); do
  npm test 2>&1 | tail -1
done
```

## Notes

- Reproduce first, fix second. If you can't reproduce it, you can't verify the fix.
- `git bisect run` is underused — it automates finding the exact commit that broke something.
- Memory leaks show as gradually increasing RSS over time. Take snapshots at intervals and compare.
- When stuck, explain the bug to someone (or write it down). Rubber duck debugging works.
- Check the obvious first: is the service running? Are env vars set? Is the config correct?
