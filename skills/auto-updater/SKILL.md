---
name: auto-updater
description: "Automatically update ThinkFleetBot and all installed skills once daily. Runs via cron, checks for updates, applies them, and messages the user with a summary of what changed."
metadata: {"version":"1.0.0","thinkfleetbot":{"emoji":"🔄","os":["darwin","linux"]}}
---

# Auto-Updater Skill

Keep your ThinkFleetBot and skills up to date automatically with daily update checks.

## What It Does

This skill sets up a daily cron job that:

1. Updates ThinkFleetBot itself (via `thinkfleetbot doctor` or package manager)
2. Updates all installed skills (via `thinkfleet-hub update --all`)
3. Messages you with a summary of what was updated

## Setup

### Quick Start

Ask ThinkFleetBot to set up the auto-updater:

```
Set up daily auto-updates for yourself and all your skills.
```

Or manually add the cron job:

```bash
thinkfleetbot cron add \
  --name "Daily Auto-Update" \
  --cron "0 4 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --wake now \
  --deliver \
  --message "Run daily auto-updates: check for ThinkFleetBot updates and update all skills. Report what was updated."
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| Time | 4:00 AM | When to run updates (use `--cron` to change) |
| Timezone | System default | Set with `--tz` |
| Delivery | Main session | Where to send the update summary |

## How Updates Work

### ThinkFleetBot Updates

For **npm/pnpm/bun installs**:
```bash
npm update -g thinkfleetbot@latest
# or: pnpm update -g thinkfleetbot@latest
# or: bun update -g thinkfleetbot@latest
```

For **source installs** (git checkout):
```bash
thinkfleetbot update
```

Always run `thinkfleetbot doctor` after updating to apply migrations.

### Skill Updates

```bash
thinkfleet-hub update --all
```

This checks all installed skills against the registry and updates any with new versions available.

## Update Summary Format

After updates complete, you'll receive a message like:

```
🔄 Daily Auto-Update Complete

**ThinkFleetBot**: Updated to v2026.1.10 (was v2026.1.9)

**Skills Updated (3)**:
- prd: 2.0.3 → 2.0.4
- browser: 1.2.0 → 1.2.1  
- nano-banana-pro: 3.1.0 → 3.1.2

**Skills Already Current (5)**:
gemini, sag, things-mac, himalaya, peekaboo

No issues encountered.
```

## Manual Commands

Check for updates without applying:
```bash
thinkfleet-hub update --all --dry-run
```

View current skill versions:
```bash
thinkfleet-hub list
```

Check ThinkFleetBot version:
```bash
thinkfleetbot --version
```

## Troubleshooting

### Updates Not Running

1. Verify cron is enabled: check `cron.enabled` in config
2. Confirm Gateway is running continuously
3. Check cron job exists: `thinkfleetbot cron list`

### Update Failures

If an update fails, the summary will include the error. Common fixes:

- **Permission errors**: Ensure the Gateway user can write to skill directories
- **Network errors**: Check internet connectivity
- **Package conflicts**: Run `thinkfleetbot doctor` to diagnose

### Disabling Auto-Updates

Remove the cron job:
```bash
thinkfleetbot cron remove "Daily Auto-Update"
```

Or disable temporarily in config:
```json
{
  "cron": {
    "enabled": false
  }
}
```

## Resources

- [ThinkFleetBot Updating Guide](https://docs.thinkfleet.dev/install/updating)
- [ThinkFleet Hub CLI](https://docs.thinkfleet.dev/tools/thinkfleet-hub)
- [Cron Jobs](https://docs.thinkfleet.dev/cron)
