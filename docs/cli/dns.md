---
summary: "CLI reference for `thinkfleetbot dns` (wide-area discovery helpers)"
read_when:
  - You want wide-area discovery (DNS-SD) via Tailscale + CoreDNS
  - You’re setting up split DNS for thinkfleetbot.internal
---

# `thinkfleetbot dns`

DNS helpers for wide-area discovery (Tailscale + CoreDNS). Currently focused on macOS + Homebrew CoreDNS.

Related:
- Gateway discovery: [Discovery](/gateway/discovery)
- Wide-area discovery config: [Configuration](/gateway/configuration)

## Setup

```bash
thinkfleetbot dns setup
thinkfleetbot dns setup --apply
```

