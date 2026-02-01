---
name: deployment-strategies
description: "Blue-green, canary, rolling deployments, rollback procedures, and deployment verification patterns."
metadata: {"thinkfleetbot":{"emoji":"🚀","requires":{"anyBins":["kubectl","gh","docker","curl"]}}}
---

# Deployment Strategies

Safe deployment patterns with verification and rollback.

## Rolling Deployment (Kubernetes)

```bash
# Update image (triggers rolling update)
kubectl set image deployment/myapp myapp=myapp:v2.0

# Watch rollout progress
kubectl rollout status deployment/myapp

# Check rollout history
kubectl rollout history deployment/myapp

# Rollback to previous version
kubectl rollout undo deployment/myapp

# Rollback to specific revision
kubectl rollout undo deployment/myapp --to-revision=3

# Pause/resume rollout
kubectl rollout pause deployment/myapp
kubectl rollout resume deployment/myapp
```

## Blue-Green Deployment

```bash
# Deploy green (new version) alongside blue (current)
kubectl apply -f deployment-green.yaml

# Verify green is healthy
kubectl get pods -l version=green
kubectl exec -it $(kubectl get pod -l version=green -o jsonpath='{.items[0].metadata.name}') -- curl -s localhost:8080/health

# Switch traffic to green
kubectl patch service myapp -p '{"spec":{"selector":{"version":"green"}}}'

# Verify traffic is flowing to green
curl -s https://myapp.example.com/version

# Rollback: switch back to blue
kubectl patch service myapp -p '{"spec":{"selector":{"version":"blue"}}}'

# Cleanup old blue after confidence period
kubectl delete deployment myapp-blue
```

## Canary Deployment

```bash
# Deploy canary (small replica count)
kubectl apply -f deployment-canary.yaml
kubectl scale deployment myapp-canary --replicas=1

# Main deployment stays at full capacity
kubectl get deployment myapp --show-labels
kubectl get deployment myapp-canary --show-labels

# Monitor canary error rate
kubectl logs -l version=canary --tail=100 | grep -c "ERROR"

# Promote canary: scale up canary, scale down main
kubectl scale deployment myapp-canary --replicas=5
kubectl scale deployment myapp --replicas=0

# Or rollback: remove canary
kubectl delete deployment myapp-canary
```

## GitHub Actions Deployment

```bash
# Trigger deployment workflow
gh workflow run deploy.yml -f environment=staging -f version=v2.0

# Watch deployment
gh run watch $(gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')

# Check deployment status
gh api repos/{owner}/{repo}/deployments --jq '.[] | {id, environment: .environment, ref: .ref, created_at: .created_at}' | head -20
```

## Docker Compose (Simple)

```bash
# Pull new images
docker compose pull

# Rolling restart (zero downtime with multiple replicas)
docker compose up -d --no-deps --scale myapp=2 myapp
sleep 10
docker compose up -d --no-deps --scale myapp=1 myapp

# Quick rollback: use previous image tag
docker compose up -d myapp
```

## Post-Deployment Verification

```bash
# Health check
curl -sf https://myapp.example.com/health | jq .

# Smoke test critical endpoints
endpoints=("/api/users" "/api/products" "/api/health")
for ep in "${endpoints[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://myapp.example.com$ep")
  echo "$ep: $status"
done

# Check error rate in logs (last 5 minutes)
kubectl logs -l app=myapp --since=5m | grep -c "ERROR"

# Check response times
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s Total: %{time_total}s\n" https://myapp.example.com/
done
```

## Notes

- Always deploy to staging first. Verify before promoting to production.
- Blue-green requires 2x resources during transition. Budget for it.
- Canary catches issues that staging misses (real traffic patterns, data shapes, scale).
- Automated rollback triggers: error rate > 1%, p95 latency > 2x baseline, health check failures.
- Keep at least 3 previous versions available for quick rollback.
