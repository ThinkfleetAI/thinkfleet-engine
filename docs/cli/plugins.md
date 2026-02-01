---
summary: "CLI reference for `thinkfleetbot plugins` (list, install, enable/disable, doctor)"
read_when:
  - You want to install or manage in-process Gateway plugins
  - You want to debug plugin load failures
---

# `thinkfleetbot plugins`

Manage Gateway plugins/extensions (loaded in-process).

Related:
- Plugin system: [Plugins](/plugin)
- Plugin manifest + schema: [Plugin manifest](/plugins/manifest)
- Security hardening: [Security](/gateway/security)

## Commands

```bash
thinkfleetbot plugins list
thinkfleetbot plugins info <id>
thinkfleetbot plugins enable <id>
thinkfleetbot plugins disable <id>
thinkfleetbot plugins doctor
thinkfleetbot plugins update <id>
thinkfleetbot plugins update --all
```

Bundled plugins ship with ThinkFleetBot but start disabled. Use `plugins enable` to
activate them.

All plugins must ship a `thinkfleetbot.plugin.json` file with an inline JSON Schema
(`configSchema`, even if empty). Missing/invalid manifests or schemas prevent
the plugin from loading and fail config validation.

### Install

```bash
thinkfleetbot plugins install <path-or-spec>
```

Security note: treat plugin installs like running code. Prefer pinned versions.

Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Use `--link` to avoid copying a local directory (adds to `plugins.load.paths`):

```bash
thinkfleetbot plugins install -l ./my-plugin
```

### Update

```bash
thinkfleetbot plugins update <id>
thinkfleetbot plugins update --all
thinkfleetbot plugins update <id> --dry-run
```

Updates only apply to plugins installed from npm (tracked in `plugins.installs`).
