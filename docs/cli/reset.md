---
summary: "CLI reference for `thinkfleetbot reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
---

# `thinkfleetbot reset`

Reset local config/state (keeps the CLI installed).

```bash
thinkfleetbot reset
thinkfleetbot reset --dry-run
thinkfleetbot reset --scope config+creds+sessions --yes --non-interactive
```

