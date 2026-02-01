---
summary: "CLI reference for `thinkfleetbot onboard` (interactive onboarding wizard)"
read_when:
  - You want guided setup for gateway, workspace, auth, channels, and skills
---

# `thinkfleetbot onboard`

Interactive onboarding wizard (local or remote Gateway setup).

Related:
- Wizard guide: [Onboarding](/start/onboarding)

## Examples

```bash
thinkfleetbot onboard
thinkfleetbot onboard --flow quickstart
thinkfleetbot onboard --flow manual
thinkfleetbot onboard --mode remote --remote-url ws://gateway-host:18789
```

Flow notes:
- `quickstart`: minimal prompts, auto-generates a gateway token.
- `manual`: full prompts for port/bind/auth (alias of `advanced`).
- Fastest first chat: `thinkfleetbot dashboard` (Control UI, no channel setup).
