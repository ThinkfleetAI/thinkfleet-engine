---
summary: "Uninstall ThinkFleetBot completely (CLI, service, state, workspace)"
read_when:
  - You want to remove ThinkFleetBot from a machine
  - The gateway service is still running after uninstall
---

# Uninstall

Two paths:
- **Easy path** if `thinkfleetbot` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
thinkfleetbot uninstall
```

Non-interactive (automation / npx):

```bash
thinkfleetbot uninstall --all --yes --non-interactive
npx -y thinkfleetbot uninstall --all --yes --non-interactive
```

Manual steps (same result):

1) Stop the gateway service:

```bash
thinkfleetbot gateway stop
```

2) Uninstall the gateway service (launchd/systemd/schtasks):

```bash
thinkfleetbot gateway uninstall
```

3) Delete state + config:

```bash
rm -rf "${THINKFLEETBOT_STATE_DIR:-$HOME/.thinkfleetbot}"
```

If you set `THINKFLEETBOT_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4) Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/thinkfleet
```

5) Remove the CLI install (pick the one you used):

```bash
npm rm -g thinkfleetbot
pnpm remove -g thinkfleetbot
bun remove -g thinkfleetbot
```

6) If you installed the macOS app:

```bash
rm -rf /Applications/ThinkFleetBot.app
```

Notes:
- If you used profiles (`--profile` / `THINKFLEETBOT_PROFILE`), repeat step 3 for each state dir (defaults are `~/.thinkfleetbot-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `thinkfleetbot` is missing.

### macOS (launchd)

Default label is `ai.thinkfleet.gateway` (or `ai.thinkfleet.<profile>`; legacy `com.thinkfleetbot.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.thinkfleet.gateway
rm -f ~/Library/LaunchAgents/ai.thinkfleet.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.thinkfleet.<profile>`. Remove any legacy `com.thinkfleetbot.*` plists if present.

### Linux (systemd user unit)

Default unit name is `thinkfleetbot-gateway.service` (or `thinkfleetbot-gateway-<profile>.service`):

```bash
systemctl --user disable --now thinkfleetbot-gateway.service
rm -f ~/.config/systemd/user/thinkfleetbot-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `ThinkFleetBot Gateway` (or `ThinkFleetBot Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "ThinkFleetBot Gateway"
Remove-Item -Force "$env:USERPROFILE\.thinkfleetbot\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.thinkfleetbot-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://thinkfleet.dev/install.sh` or `install.ps1`, the CLI was installed with `npm install -g thinkfleetbot@latest`.
Remove it with `npm rm -g thinkfleetbot` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `thinkfleetbot ...` / `bun run thinkfleetbot ...`):

1) Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2) Delete the repo directory.
3) Remove state + workspace as shown above.
