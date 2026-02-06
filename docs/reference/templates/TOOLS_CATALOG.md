# Tool Catalog

This file lists all available tools organized by category.
To use tools beyond the core set, load them by category.

## Quick Reference

**Always Available:** read, load_tools, saas, session_status

**To Load More Tools:**
```
load_tools({ categories: ["files", "web"] })
```

---

## Categories

### core — Core

Essential tools always available

**Use when:** Always loaded

**Tools:**
- `read`
- `load_tools`
- `saas`
- `session_status`

*These tools are always loaded.*

### files — File Operations

Read, write, edit, and search files

**Use when:** User asks about files, code, documents, or needs file modifications

**Tools:**
- `write`
- `edit`
- `apply_patch`
- `grep`
- `find`
- `ls`

### shell — Shell / Commands

Execute shell commands and manage processes

**Use when:** User needs to run commands, scripts, install packages, or manage processes

**Tools:**
- `exec`
- `process`

### web — Web Access

Search the web, fetch URLs, and control browser

**Use when:** User needs current information, research, or content from websites

**Tools:**
- `web_search`
- `web_fetch`
- `browser`

### messaging — Messaging

Send messages, manage sessions, spawn sub-agents, and text-to-speech

**Use when:** User needs to contact someone, send notifications, or manage sub-agents

**Tools:**
- `message`
- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`
- `agents_list`
- `tts`

### integrations — Integrations (OAuth)

Access connected services like Gmail, Google Drive, Slack, Calendar

**Use when:** User asks about email, Drive files, Slack messages, calendar events

**Available Integrations (via `saas` tool):**
- Gmail: `saas action=integrations_get_token appName=gmail`
- Google Drive: `saas action=integrations_get_token appName=google-drive`
- Google Calendar: `saas action=integrations_get_token appName=google-calendar`
- Slack: `saas action=integrations_get_token appName=slack`
- GitHub: `saas action=integrations_get_token appName=github`

First call `saas action=integrations_list` to see connected integrations.

### scheduling — Scheduling

Create reminders, scheduled tasks, and cron jobs

**Use when:** User wants reminders, scheduled notifications, or recurring tasks

**Tools:**
- `cron`

### media — Media / Images

Analyze images, create visual content, and work with media

**Use when:** User shares images, screenshots, or asks for visual analysis

**Tools:**
- `image`
- `canvas`

### memory — Memory

Search and retrieve from long-term memory (requires memory-core plugin)

**Use when:** User asks about past conversations, preferences, or stored knowledge

**Tools:**
- `memory_search`
- `memory_get`
- `memory_categories`

*Requires plugin to be installed and enabled.*

### admin — Admin / Gateway

System administration, node management, and file publishing

**Use when:** User asks to update, restart, or configure the agent

**Tools:**
- `gateway`
- `nodes`
- `publish_file`

### voice — Voice Calls

Make phone calls and voice conversations (requires voice-call plugin)

**Use when:** User wants to make a phone call or have a voice conversation

**Tools:**
- `voice_call`

*Requires plugin to be installed and enabled.*

### plugins — Plugin Tools

Additional tools from installed plugins (llm_task, lobster, etc.)

**Use when:** User needs specialized plugin functionality

**Tools:**
- `llm_task`
- `lobster`

*Requires plugin to be installed and enabled.*

---

## Docker Development Tools

The following CLI tools are pre-installed in the Docker image and available via the `exec` tool:

| Tool | Description |
|------|-------------|
| `ffmpeg` | Video/audio processing and editing |
| `python3` | Python interpreter with pip and venv |
| `jq` | JSON processor |
| `psql` | PostgreSQL client |
| `mysql` | MySQL client |
| `redis-cli` | Redis client |
| `gh` | GitHub CLI |
| `kubectl` | Kubernetes CLI |
| `aws` | AWS CLI v2 |
| `az` | Azure CLI |
| `terraform` | Infrastructure as code |
| `clawdhub` | Skill management CLI |

**Example - Edit video with ffmpeg:**
```
exec command="ffmpeg -y -hide_banner -i video.mp4 -ss 00:01:00 -t 30 -c copy clip.mp4"
```

---

## Skills System

Skills are markdown instruction files that extend the agent's knowledge.
Over 300+ skills are available covering topics like:

- **Cloud/DevOps:** AWS, Azure, GCP, Terraform, Kubernetes, Docker
- **Development:** TypeScript, Python, Rust, React, testing, code review
- **Video/Media:** FFmpeg video editor, video subtitles, image processing
- **Productivity:** Gmail, Calendar, Slack, Linear, Notion, Obsidian
- **APIs:** Stripe, Twilio, SendGrid, Shopify, and many more

Skills are loaded automatically based on context or can be requested by the user.
Use `skills list` to see available skills.

---

## Usage Examples

### User asks: "Read my emails from today"
1. Check integrations: `saas action=integrations_list`
2. Get Gmail token: `saas action=integrations_get_token appName=gmail`
3. Use token with Gmail API

### User asks: "Edit my config file"
1. Load file tools: `load_tools({ categories: ["files"] })`
2. Read the file: `read path=/path/to/config`
3. Edit the file: `edit path=/path/to/config ...`

### User asks: "Search the web for latest news"
1. Load web tools: `load_tools({ categories: ["web"] })`
2. Search: `web_search query="latest news"`

### User asks: "Trim my video to the first 30 seconds"
1. Load shell tools: `load_tools({ categories: ["shell"] })`
2. Run ffmpeg: `exec command="ffmpeg -y -i video.mp4 -t 30 -c copy trimmed.mp4"`

---

*This catalog is auto-generated from tool-categories.ts*
