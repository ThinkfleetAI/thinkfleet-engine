---
summary: "CLI reference for `thinkfleetbot config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
---

# `thinkfleetbot config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `thinkfleetbot configure`).

## Examples

```bash
thinkfleetbot config get browser.executablePath
thinkfleetbot config set browser.executablePath "/usr/bin/google-chrome"
thinkfleetbot config set agents.defaults.heartbeat.every "2h"
thinkfleetbot config set agents.list[0].tools.exec.node "node-id-or-name"
thinkfleetbot config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
thinkfleetbot config get agents.defaults.workspace
thinkfleetbot config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
thinkfleetbot config get agents.list
thinkfleetbot config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--json` to require JSON5 parsing.

```bash
thinkfleetbot config set agents.defaults.heartbeat.every "0m"
thinkfleetbot config set gateway.port 19001 --json
thinkfleetbot config set channels.whatsapp.groups '["*"]' --json
```

Restart the gateway after edits.
