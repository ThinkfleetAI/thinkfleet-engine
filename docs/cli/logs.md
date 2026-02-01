---
summary: "CLI reference for `thinkfleetbot logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
---

# `thinkfleetbot logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:
- Logging overview: [Logging](/logging)

## Examples

```bash
thinkfleetbot logs
thinkfleetbot logs --follow
thinkfleetbot logs --json
thinkfleetbot logs --limit 500
```

