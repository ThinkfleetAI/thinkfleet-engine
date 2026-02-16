# ThinkFleet Engine

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Sustainable%20Use-blue.svg?style=for-the-badge" alt="Sustainable Use License"></a>
</p>

**ThinkFleet Engine** is an open-source AI agent runtime with a plugin SDK. It connects to 15+ messaging channels (WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, WebChat, and more), supports 340+ skills, and runs on your own devices — self-hosted and fully under your control.

The engine is a standalone product: install it, point it at your LLM provider, and you have a fully functional AI assistant. For teams and businesses, the optional [ThinkFleet SaaS platform](https://thinkfleet.com) adds managed credentials, billing, multi-agent orchestration, and a hosted control plane via a plugin that snaps into the engine.

## Architecture

```
thinkfleet-engine (open source, MIT)
  + Plugin SDK: registerTool(), registerChannel(), registerHook(), registerService(), ...
  + 15+ built-in channels, 340+ skills, browser/canvas/cron/media tools
  + Gateway WebSocket control plane

@thinkfleet/saas-connector (optional, proprietary plugin)
  + Managed API key vault (100+ providers)
  + Token budget enforcement
  + Multi-agent orchestration (crews)
  + OAuth marketplace (800+ services via Composio)
  + Virtual card provisioning
```

## Quick links

[Docs](https://docs.thinkfleet.dev) · [Getting Started](https://docs.thinkfleet.dev/start/getting-started) · [Plugin SDK](https://docs.thinkfleet.dev/tools/skills) · [Channels](https://docs.thinkfleet.dev/channels) · [Docker](https://docs.thinkfleet.dev/install/docker)

Preferred setup: run the onboarding wizard (`thinkfleet-engine onboard`). It walks through gateway, workspace, channels, and skills. Works on **macOS, Linux, and Windows (via WSL2)**.
Works with npm, pnpm, or bun.

**Subscriptions (OAuth):**
- **[Anthropic](https://www.anthropic.com/)** (Claude Pro/Max)
- **[OpenAI](https://openai.com/)** (ChatGPT/Codex)

Model note: while any model is supported, I strongly recommend **Anthropic Pro/Max (100/200) + Opus 4.5** for long‑context strength and better prompt‑injection resistance. See [Onboarding](https://docs.thinkfleet.dev/start/onboarding).

## Models (selection + auth)

- Models config + CLI: [Models](https://docs.thinkfleet.dev/concepts/models)
- Auth profile rotation (OAuth vs API keys) + fallbacks: [Model failover](https://docs.thinkfleet.dev/concepts/model-failover)

## Install

Runtime: **Node ≥22**.

```bash
npm install -g thinkfleet-engine@latest
# or: pnpm add -g thinkfleet-engine@latest

thinkfleet-engine onboard --install-daemon
```

The wizard installs the Gateway daemon (launchd/systemd user service) so it stays running.
Legacy CLI name `thinkfleet` remains available as a compatibility alias.

## Quick start

Runtime: **Node ≥22**.

Full beginner guide (auth, pairing, channels): [Getting started](https://docs.thinkfleet.dev/start/getting-started)

```bash
thinkfleet-engine onboard --install-daemon

thinkfleet-engine gateway --port 18789 --verbose

# Send a message
thinkfleet-engine message send --to +1234567890 --message "Hello"

# Talk to the assistant
thinkfleet-engine agent --message "Ship checklist" --thinking high
```

Upgrading? [Updating guide](https://docs.thinkfleet.dev/install/updating) (and run `thinkfleet-engine doctor`).

## Development channels

- **stable**: tagged releases (`vYYYY.M.D` or `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta**: prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (macOS app may be missing).
- **dev**: moving head of `main`, npm dist-tag `dev` (when published).

Switch channels (git + npm): `thinkfleet-engine update --channel stable|beta|dev`.
Details: [Development channels](https://docs.thinkfleet.dev/install/development-channels).

## From source (development)

Prefer `pnpm` for builds from source.

```bash
git clone https://github.com/rrader26/thinkfleet-engine.git
cd thinkfleet-engine

pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build

pnpm thinkfleet-engine onboard --install-daemon

# Dev loop (auto-reload on TS changes)
pnpm gateway:watch
```

Note: `pnpm thinkfleet-engine ...` runs TypeScript directly (via `tsx`). `pnpm build` produces `dist/` for running via Node.

## Security defaults (DM access)

ThinkFleet Engine connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

Full security guide: [Security](https://docs.thinkfleet.dev/gateway/security)

Default behavior on Telegram/WhatsApp/Signal/iMessage/Microsoft Teams/Discord/Google Chat/Slack:
- **DM pairing** (`dmPolicy="pairing"` / `channels.discord.dm.policy="pairing"` / `channels.slack.dm.policy="pairing"`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve with: `thinkfleet-engine pairing approve <channel> <code>` (then the sender is added to a local allowlist store).
- Public inbound DMs require an explicit opt-in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom` / `channels.discord.dm.allowFrom` / `channels.slack.dm.allowFrom`).

Run `thinkfleet-engine doctor` to surface risky/misconfigured DM policies.

## Highlights

- **[Local-first Gateway](https://docs.thinkfleet.dev/gateway)** — single control plane for sessions, channels, tools, and events.
- **[Multi-channel inbox](https://docs.thinkfleet.dev/channels)** — WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, BlueBubbles, Microsoft Teams, Matrix, Zalo, Zalo Personal, WebChat, macOS, iOS/Android.
- **[Multi-agent routing](https://docs.thinkfleet.dev/gateway/configuration)** — route inbound channels/accounts/peers to isolated agents (workspaces + per-agent sessions).
- **[Voice Wake](https://docs.thinkfleet.dev/nodes/voicewake) + [Talk Mode](https://docs.thinkfleet.dev/nodes/talk)** — always-on speech for macOS/iOS/Android with ElevenLabs.
- **[Live Canvas](https://docs.thinkfleet.dev/platforms/mac/canvas)** — agent-driven visual workspace with [A2UI](https://docs.thinkfleet.dev/platforms/mac/canvas#canvas-a2ui).
- **[First-class tools](https://docs.thinkfleet.dev/tools)** — browser, canvas, nodes, cron, sessions, and Discord/Slack actions.
- **[Companion apps](https://docs.thinkfleet.dev/platforms/macos)** — macOS menu bar app + iOS/Android [nodes](https://docs.thinkfleet.dev/nodes).
- **[Onboarding](https://docs.thinkfleet.dev/start/wizard) + [skills](https://docs.thinkfleet.dev/tools/skills)** — wizard-driven setup with bundled/managed/workspace skills.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=thinkfleetbot/thinkfleetbot&type=date&legend=top-left)](https://www.star-history.com/#thinkfleetbot/thinkfleetbot&type=date&legend=top-left)

## Everything we built so far

### Core platform
- [Gateway WS control plane](https://docs.thinkfleet.dev/gateway) with sessions, presence, config, cron, webhooks, [Control UI](https://docs.thinkfleet.dev/web), and [Canvas host](https://docs.thinkfleet.dev/platforms/mac/canvas#canvas-a2ui).
- [CLI surface](https://docs.thinkfleet.dev/tools/agent-send): gateway, agent, send, [wizard](https://docs.thinkfleet.dev/start/wizard), and [doctor](https://docs.thinkfleet.dev/gateway/doctor).
- [Pi agent runtime](https://docs.thinkfleet.dev/concepts/agent) in RPC mode with tool streaming and block streaming.
- [Session model](https://docs.thinkfleet.dev/concepts/session): `main` for direct chats, group isolation, activation modes, queue modes, reply-back. Group rules: [Groups](https://docs.thinkfleet.dev/concepts/groups).
- [Media pipeline](https://docs.thinkfleet.dev/nodes/images): images/audio/video, transcription hooks, size caps, temp file lifecycle. Audio details: [Audio](https://docs.thinkfleet.dev/nodes/audio).

### Channels
- [Channels](https://docs.thinkfleet.dev/channels): [WhatsApp](https://docs.thinkfleet.dev/channels/whatsapp) (Baileys), [Telegram](https://docs.thinkfleet.dev/channels/telegram) (grammY), [Slack](https://docs.thinkfleet.dev/channels/slack) (Bolt), [Discord](https://docs.thinkfleet.dev/channels/discord) (discord.js), [Google Chat](https://docs.thinkfleet.dev/channels/googlechat) (Chat API), [Signal](https://docs.thinkfleet.dev/channels/signal) (signal-cli), [iMessage](https://docs.thinkfleet.dev/channels/imessage) (imsg), [BlueBubbles](https://docs.thinkfleet.dev/channels/bluebubbles) (extension), [Microsoft Teams](https://docs.thinkfleet.dev/channels/msteams) (extension), [Matrix](https://docs.thinkfleet.dev/channels/matrix) (extension), [Zalo](https://docs.thinkfleet.dev/channels/zalo) (extension), [Zalo Personal](https://docs.thinkfleet.dev/channels/zalouser) (extension), [WebChat](https://docs.thinkfleet.dev/web/webchat).
- [Group routing](https://docs.thinkfleet.dev/concepts/group-messages): mention gating, reply tags, per-channel chunking and routing. Channel rules: [Channels](https://docs.thinkfleet.dev/channels).

### Apps + nodes
- [macOS app](https://docs.thinkfleet.dev/platforms/macos): menu bar control plane, [Voice Wake](https://docs.thinkfleet.dev/nodes/voicewake)/PTT, [Talk Mode](https://docs.thinkfleet.dev/nodes/talk) overlay, [WebChat](https://docs.thinkfleet.dev/web/webchat), debug tools, [remote gateway](https://docs.thinkfleet.dev/gateway/remote) control.
- [iOS node](https://docs.thinkfleet.dev/platforms/ios): [Canvas](https://docs.thinkfleet.dev/platforms/mac/canvas), [Voice Wake](https://docs.thinkfleet.dev/nodes/voicewake), [Talk Mode](https://docs.thinkfleet.dev/nodes/talk), camera, screen recording, Bonjour pairing.
- [Android node](https://docs.thinkfleet.dev/platforms/android): [Canvas](https://docs.thinkfleet.dev/platforms/mac/canvas), [Talk Mode](https://docs.thinkfleet.dev/nodes/talk), camera, screen recording, optional SMS.
- [macOS node mode](https://docs.thinkfleet.dev/nodes): system.run/notify + canvas/camera exposure.

### Tools + automation
- [Browser control](https://docs.thinkfleet.dev/tools/browser): dedicated thinkfleet-engineChrome/Chromium, snapshots, actions, uploads, profiles.
- [Canvas](https://docs.thinkfleet.dev/platforms/mac/canvas): [A2UI](https://docs.thinkfleet.dev/platforms/mac/canvas#canvas-a2ui) push/reset, eval, snapshot.
- [Nodes](https://docs.thinkfleet.dev/nodes): camera snap/clip, screen record, [location.get](https://docs.thinkfleet.dev/nodes/location-command), notifications.
- [Cron + wakeups](https://docs.thinkfleet.dev/automation/cron-jobs); [webhooks](https://docs.thinkfleet.dev/automation/webhook); [Gmail Pub/Sub](https://docs.thinkfleet.dev/automation/gmail-pubsub).
- [Skills platform](https://docs.thinkfleet.dev/tools/skills): bundled, managed, and workspace skills with install gating + UI.

### Runtime + safety
- [Channel routing](https://docs.thinkfleet.dev/concepts/channel-routing), [retry policy](https://docs.thinkfleet.dev/concepts/retry), and [streaming/chunking](https://docs.thinkfleet.dev/concepts/streaming).
- [Presence](https://docs.thinkfleet.dev/concepts/presence), [typing indicators](https://docs.thinkfleet.dev/concepts/typing-indicators), and [usage tracking](https://docs.thinkfleet.dev/concepts/usage-tracking).
- [Models](https://docs.thinkfleet.dev/concepts/models), [model failover](https://docs.thinkfleet.dev/concepts/model-failover), and [session pruning](https://docs.thinkfleet.dev/concepts/session-pruning).
- [Security](https://docs.thinkfleet.dev/gateway/security) and [troubleshooting](https://docs.thinkfleet.dev/channels/troubleshooting).

### Ops + packaging
- [Control UI](https://docs.thinkfleet.dev/web) + [WebChat](https://docs.thinkfleet.dev/web/webchat) served directly from the Gateway.
- [Tailscale Serve/Funnel](https://docs.thinkfleet.dev/gateway/tailscale) or [SSH tunnels](https://docs.thinkfleet.dev/gateway/remote) with token/password auth.
- [Nix mode](https://docs.thinkfleet.dev/install/nix) for declarative config; [Docker](https://docs.thinkfleet.dev/install/docker)-based installs.
- [Doctor](https://docs.thinkfleet.dev/gateway/doctor) migrations, [logging](https://docs.thinkfleet.dev/logging).

## How it works (short)

```
WhatsApp / Telegram / Slack / Discord / Google Chat / Signal / iMessage / BlueBubbles / Microsoft Teams / Matrix / Zalo / Zalo Personal / WebChat
               │
               ▼
┌───────────────────────────────┐
│            Gateway            │
│       (control plane)         │
│     ws://127.0.0.1:18789      │
└──────────────┬────────────────┘
               │
               ├─ Pi agent (RPC)
               ├─ CLI (thinkfleet-engine…)
               ├─ WebChat UI
               ├─ macOS app
               └─ iOS / Android nodes
```

## Key subsystems

- **[Gateway WebSocket network](https://docs.thinkfleet.dev/concepts/architecture)** — single WS control plane for clients, tools, and events (plus ops: [Gateway runbook](https://docs.thinkfleet.dev/gateway)).
- **[Tailscale exposure](https://docs.thinkfleet.dev/gateway/tailscale)** — Serve/Funnel for the Gateway dashboard + WS (remote access: [Remote](https://docs.thinkfleet.dev/gateway/remote)).
- **[Browser control](https://docs.thinkfleet.dev/tools/browser)** — engine‑managed Chrome/Chromium with CDP control.
- **[Canvas + A2UI](https://docs.thinkfleet.dev/platforms/mac/canvas)** — agent‑driven visual workspace (A2UI host: [Canvas/A2UI](https://docs.thinkfleet.dev/platforms/mac/canvas#canvas-a2ui)).
- **[Voice Wake](https://docs.thinkfleet.dev/nodes/voicewake) + [Talk Mode](https://docs.thinkfleet.dev/nodes/talk)** — always‑on speech and continuous conversation.
- **[Nodes](https://docs.thinkfleet.dev/nodes)** — Canvas, camera snap/clip, screen record, `location.get`, notifications, plus macOS‑only `system.run`/`system.notify`.

## Tailscale access (Gateway dashboard)

ThinkFleet Engine can auto-configure Tailscale **Serve** (tailnet-only) or **Funnel** (public) while the Gateway stays bound to loopback. Configure `gateway.tailscale.mode`:

- `off`: no Tailscale automation (default).
- `serve`: tailnet-only HTTPS via `tailscale serve` (uses Tailscale identity headers by default).
- `funnel`: public HTTPS via `tailscale funnel` (requires shared password auth).

Notes:
- `gateway.bind` must stay `loopback` when Serve/Funnel is enabled (ThinkFleet Engine enforces this).
- Serve can be forced to require a password by setting `gateway.auth.mode: "password"` or `gateway.auth.allowTailscale: false`.
- Funnel refuses to start unless `gateway.auth.mode: "password"` is set.
- Optional: `gateway.tailscale.resetOnExit` to undo Serve/Funnel on shutdown.

Details: [Tailscale guide](https://docs.thinkfleet.dev/gateway/tailscale) · [Web surfaces](https://docs.thinkfleet.dev/web)

## Remote Gateway (Linux is great)

It’s perfectly fine to run the Gateway on a small Linux instance. Clients (macOS app, CLI, WebChat) can connect over **Tailscale Serve/Funnel** or **SSH tunnels**, and you can still pair device nodes (macOS/iOS/Android) to execute device‑local actions when needed.

- **Gateway host** runs the exec tool and channel connections by default.
- **Device nodes** run device‑local actions (`system.run`, camera, screen recording, notifications) via `node.invoke`.
In short: exec runs where the Gateway lives; device actions run where the device lives.

Details: [Remote access](https://docs.thinkfleet.dev/gateway/remote) · [Nodes](https://docs.thinkfleet.dev/nodes) · [Security](https://docs.thinkfleet.dev/gateway/security)

## macOS permissions via the Gateway protocol

The macOS app can run in **node mode** and advertises its capabilities + permission map over the Gateway WebSocket (`node.list` / `node.describe`). Clients can then execute local actions via `node.invoke`:

- `system.run` runs a local command and returns stdout/stderr/exit code; set `needsScreenRecording: true` to require screen-recording permission (otherwise you’ll get `PERMISSION_MISSING`).
- `system.notify` posts a user notification and fails if notifications are denied.
- `canvas.*`, `camera.*`, `screen.record`, and `location.get` are also routed via `node.invoke` and follow TCC permission status.

Elevated bash (host permissions) is separate from macOS TCC:

- Use `/elevated on|off` to toggle per‑session elevated access when enabled + allowlisted.
- Gateway persists the per‑session toggle via `sessions.patch` (WS method) alongside `thinkingLevel`, `verboseLevel`, `model`, `sendPolicy`, and `groupActivation`.

Details: [Nodes](https://docs.thinkfleet.dev/nodes) · [macOS app](https://docs.thinkfleet.dev/platforms/macos) · [Gateway protocol](https://docs.thinkfleet.dev/concepts/architecture)

## Agent to Agent (sessions_* tools)

- Use these to coordinate work across sessions without jumping between chat surfaces.
- `sessions_list` — discover active sessions (agents) and their metadata.
- `sessions_history` — fetch transcript logs for a session.
- `sessions_send` — message another session; optional reply‑back ping‑pong + announce step (`REPLY_SKIP`, `ANNOUNCE_SKIP`).

Details: [Session tools](https://docs.thinkfleet.dev/concepts/session-tool)

## Skills registry (ThinkFleet Skills Hub)

ThinkFleet Skills Hub is a minimal skill registry. With the Skills Hub enabled, the agent can search for skills automatically and pull in new ones as needed.

[ThinkFleet Skills Hub](https://thinkfleet.dev/skills)

## Chat commands

Send these in WhatsApp/Telegram/Slack/Google Chat/Microsoft Teams/WebChat (group commands are owner-only):

- `/status` — compact session status (model + tokens, cost when available)
- `/new` or `/reset` — reset the session
- `/compact` — compact session context (summary)
- `/think <level>` — off|minimal|low|medium|high|xhigh (GPT-5.2 + Codex models only)
- `/verbose on|off`
- `/usage off|tokens|full` — per-response usage footer
- `/restart` — restart the gateway (owner-only in groups)
- `/activation mention|always` — group activation toggle (groups only)

## Agent workspace + skills

- Workspace root: `~/thinkfleet` (configurable via `agents.defaults.workspace`).
- Injected prompt files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`.
- Skills: `~/thinkfleet/skills/<skill>/SKILL.md`.

## Configuration

Minimal `~/.thinkfleet/thinkfleet.json` (model + defaults):

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-5"
  }
}
```

[Full configuration reference (all keys + examples).](https://docs.thinkfleet.dev/gateway/configuration)

## Security model (important)

- **Default:** tools run on the host for the **main** session, so the agent has full access when it’s just you.
- **Group/channel safety:** set `agents.defaults.sandbox.mode: "non-main"` to run **non‑main sessions** (groups/channels) inside per‑session Docker sandboxes; bash then runs in Docker for those sessions.
- **Sandbox defaults:** allowlist `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`; denylist `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`.

Details: [Security guide](https://docs.thinkfleet.dev/gateway/security) · [Docker + sandboxing](https://docs.thinkfleet.dev/install/docker) · [Sandbox config](https://docs.thinkfleet.dev/gateway/configuration)

### [WhatsApp](https://docs.thinkfleet.dev/channels/whatsapp)

- Link the device: `pnpm thinkfleet-engine channels login` (stores creds in `~/.thinkfleet/credentials`).
- Allowlist who can talk to the assistant via `channels.whatsapp.allowFrom`.
- If `channels.whatsapp.groups` is set, it becomes a group allowlist; include `"*"` to allow all.

### [Telegram](https://docs.thinkfleet.dev/channels/telegram)

- Set `TELEGRAM_BOT_TOKEN` or `channels.telegram.botToken` (env wins).
- Optional: set `channels.telegram.groups` (with `channels.telegram.groups."*".requireMention`); when set, it is a group allowlist (include `"*"` to allow all). Also `channels.telegram.allowFrom` or `channels.telegram.webhookUrl` as needed.

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF"
    }
  }
}
```

### [Slack](https://docs.thinkfleet.dev/channels/slack)

- Set `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` (or `channels.slack.botToken` + `channels.slack.appToken`).

### [Discord](https://docs.thinkfleet.dev/channels/discord)

- Set `DISCORD_BOT_TOKEN` or `channels.discord.token` (env wins).
- Optional: set `commands.native`, `commands.text`, or `commands.useAccessGroups`, plus `channels.discord.dm.allowFrom`, `channels.discord.guilds`, or `channels.discord.mediaMaxMb` as needed.

```json5
{
  channels: {
    discord: {
      token: "1234abcd"
    }
  }
}
```

### [Signal](https://docs.thinkfleet.dev/channels/signal)

- Requires `signal-cli` and a `channels.signal` config section.

### [iMessage](https://docs.thinkfleet.dev/channels/imessage)

- macOS only; Messages must be signed in.
- If `channels.imessage.groups` is set, it becomes a group allowlist; include `"*"` to allow all.

### [Microsoft Teams](https://docs.thinkfleet.dev/channels/msteams)

- Configure a Teams app + Bot Framework, then add a `msteams` config section.
- Allowlist who can talk via `msteams.allowFrom`; group access via `msteams.groupAllowFrom` or `msteams.groupPolicy: "open"`.

### [WebChat](https://docs.thinkfleet.dev/web/webchat)

- Uses the Gateway WebSocket; no separate WebChat port/config.

Browser control (optional):

```json5
{
  browser: {
    enabled: true,
    color: "#FF4500"
  }
}
```

## Docs

Use these when you’re past the onboarding flow and want the deeper reference.
- [Start with the docs index for navigation and “what’s where.”](https://docs.thinkfleet.dev)
- [Read the architecture overview for the gateway + protocol model.](https://docs.thinkfleet.dev/concepts/architecture)
- [Use the full configuration reference when you need every key and example.](https://docs.thinkfleet.dev/gateway/configuration)
- [Run the Gateway by the book with the operational runbook.](https://docs.thinkfleet.dev/gateway)
- [Learn how the Control UI/Web surfaces work and how to expose them safely.](https://docs.thinkfleet.dev/web)
- [Understand remote access over SSH tunnels or tailnets.](https://docs.thinkfleet.dev/gateway/remote)
- [Follow the onboarding wizard flow for a guided setup.](https://docs.thinkfleet.dev/start/wizard)
- [Wire external triggers via the webhook surface.](https://docs.thinkfleet.dev/automation/webhook)
- [Set up Gmail Pub/Sub triggers.](https://docs.thinkfleet.dev/automation/gmail-pubsub)
- [Learn the macOS menu bar companion details.](https://docs.thinkfleet.dev/platforms/mac/menu-bar)
- [Platform guides: Windows (WSL2)](https://docs.thinkfleet.dev/platforms/windows), [Linux](https://docs.thinkfleet.dev/platforms/linux), [macOS](https://docs.thinkfleet.dev/platforms/macos), [iOS](https://docs.thinkfleet.dev/platforms/ios), [Android](https://docs.thinkfleet.dev/platforms/android)
- [Debug common failures with the troubleshooting guide.](https://docs.thinkfleet.dev/channels/troubleshooting)
- [Review security guidance before exposing anything.](https://docs.thinkfleet.dev/gateway/security)

## Advanced docs (discovery + control)

- [Discovery + transports](https://docs.thinkfleet.dev/gateway/discovery)
- [Bonjour/mDNS](https://docs.thinkfleet.dev/gateway/bonjour)
- [Gateway pairing](https://docs.thinkfleet.dev/gateway/pairing)
- [Remote gateway README](https://docs.thinkfleet.dev/gateway/remote-gateway-readme)
- [Control UI](https://docs.thinkfleet.dev/web/control-ui)
- [Dashboard](https://docs.thinkfleet.dev/web/dashboard)

## Operations & troubleshooting

- [Health checks](https://docs.thinkfleet.dev/gateway/health)
- [Gateway lock](https://docs.thinkfleet.dev/gateway/gateway-lock)
- [Background process](https://docs.thinkfleet.dev/gateway/background-process)
- [Browser troubleshooting (Linux)](https://docs.thinkfleet.dev/tools/browser-linux-troubleshooting)
- [Logging](https://docs.thinkfleet.dev/logging)

## Deep dives

- [Agent loop](https://docs.thinkfleet.dev/concepts/agent-loop)
- [Presence](https://docs.thinkfleet.dev/concepts/presence)
- [TypeBox schemas](https://docs.thinkfleet.dev/concepts/typebox)
- [RPC adapters](https://docs.thinkfleet.dev/reference/rpc)
- [Queue](https://docs.thinkfleet.dev/concepts/queue)

## Workspace & skills

- [Skills config](https://docs.thinkfleet.dev/tools/skills-config)
- [Default AGENTS](https://docs.thinkfleet.dev/reference/AGENTS.default)
- [Templates: AGENTS](https://docs.thinkfleet.dev/reference/templates/AGENTS)
- [Templates: BOOTSTRAP](https://docs.thinkfleet.dev/reference/templates/BOOTSTRAP)
- [Templates: IDENTITY](https://docs.thinkfleet.dev/reference/templates/IDENTITY)
- [Templates: SOUL](https://docs.thinkfleet.dev/reference/templates/SOUL)
- [Templates: TOOLS](https://docs.thinkfleet.dev/reference/templates/TOOLS)
- [Templates: USER](https://docs.thinkfleet.dev/reference/templates/USER)

## Platform internals

- [macOS dev setup](https://docs.thinkfleet.dev/platforms/mac/dev-setup)
- [macOS menu bar](https://docs.thinkfleet.dev/platforms/mac/menu-bar)
- [macOS voice wake](https://docs.thinkfleet.dev/platforms/mac/voicewake)
- [iOS node](https://docs.thinkfleet.dev/platforms/ios)
- [Android node](https://docs.thinkfleet.dev/platforms/android)
- [Windows (WSL2)](https://docs.thinkfleet.dev/platforms/windows)
- [Linux app](https://docs.thinkfleet.dev/platforms/linux)

## Email hooks (Gmail)

- [docs.thinkfleet.dev/gmail-pubsub](https://docs.thinkfleet.dev/automation/gmail-pubsub)
