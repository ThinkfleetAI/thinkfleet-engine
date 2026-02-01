---
summary: "CLI reference for `thinkfleetbot configure` (interactive configuration prompts)"
read_when:
  - You want to tweak credentials, devices, or agent defaults interactively
---

# `thinkfleetbot configure`

Interactive prompt to set up credentials, devices, and agent defaults.

Note: The **Model** section now includes a multi-select for the
`agents.defaults.models` allowlist (what shows up in `/model` and the model picker).

Tip: `thinkfleetbot config` without a subcommand opens the same wizard. Use
`thinkfleetbot config get|set|unset` for non-interactive edits.

Related:
- Gateway configuration reference: [Configuration](/gateway/configuration)
- Config CLI: [Config](/cli/config)

Notes:
- Choosing where the Gateway runs always updates `gateway.mode`. You can select "Continue" without other sections if that is all you need.
- Channel-oriented services (Slack/Discord/Matrix/Microsoft Teams) prompt for channel/room allowlists during setup. You can enter names or IDs; the wizard resolves names to IDs when possible.

## Examples

```bash
thinkfleetbot configure
thinkfleetbot configure --section models --section channels
```
