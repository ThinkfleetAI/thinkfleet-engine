---
name: skills-hub
description: Use the ThinkFleet Skills Hub CLI to search, install, update, and publish agent skills. Use when you need to fetch new skills on the fly, sync installed skills to latest or a specific version, or publish new/updated skill folders.
metadata: {"thinkfleetbot":{"requires":{"bins":["thinkfleet"]}}}
---

# ThinkFleet Skills Hub

Search
```bash
thinkfleet skills search "postgres backups"
```

Install
```bash
thinkfleet skills install my-skill
```

Update
```bash
thinkfleet skills update my-skill
thinkfleet skills update --all
```

List
```bash
thinkfleet skills list
```

Notes
- Skills are installed to the agent workspace: `./skills/<skill>/SKILL.md`
- Use `thinkfleet skills check` to verify all skill dependencies are met
