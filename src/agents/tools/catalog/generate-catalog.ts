#!/usr/bin/env npx tsx
/**
 * Generate TOOLS_CATALOG.md from tool category definitions
 *
 * Run: npx tsx src/agents/tools/catalog/generate-catalog.ts
 *
 * This script generates a markdown file that the agent can read to understand
 * what tools are available and how to load them by category.
 */

import fs from "node:fs";
import path from "node:path";
import { TOOL_CATEGORIES, CORE_TOOLS } from "./tool-categories.js";

function generateCatalog(): string {
  const lines: string[] = [];

  lines.push("# Tool Catalog");
  lines.push("");
  lines.push("This file lists all available tools organized by category.");
  lines.push("To use tools beyond the core set, load them by category.");
  lines.push("");
  lines.push("## Quick Reference");
  lines.push("");
  lines.push("**Always Available:** " + CORE_TOOLS.join(", "));
  lines.push("");
  lines.push("**To Load More Tools:**");
  lines.push("```");
  lines.push('load_tools({ categories: ["files", "web"] })');
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Categories");
  lines.push("");

  for (const category of TOOL_CATEGORIES) {
    lines.push(`### ${category.id} — ${category.label}`);
    lines.push("");
    lines.push(category.description);
    lines.push("");
    lines.push(`**Use when:** ${category.useWhen}`);
    lines.push("");

    if (category.tools.length > 0) {
      lines.push("**Tools:**");
      for (const tool of category.tools) {
        lines.push(`- \`${tool}\``);
      }
    } else if (category.id === "integrations") {
      lines.push("**Available Integrations (via `saas` tool):**");
      lines.push("- Gmail: `saas action=integrations_get_token appName=gmail`");
      lines.push("- Google Drive: `saas action=integrations_get_token appName=google-drive`");
      lines.push("- Google Calendar: `saas action=integrations_get_token appName=google-calendar`");
      lines.push("- Slack: `saas action=integrations_get_token appName=slack`");
      lines.push("- GitHub: `saas action=integrations_get_token appName=github`");
      lines.push("");
      lines.push("First call `saas action=integrations_list` to see connected integrations.");
    }

    if (category.alwaysLoaded) {
      lines.push("");
      lines.push("*These tools are always loaded.*");
    }

    if (category.pluginProvided) {
      lines.push("");
      lines.push("*Requires plugin to be installed and enabled.*");
    }

    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Docker Development Tools");
  lines.push("");
  lines.push(
    "The following CLI tools are pre-installed in the Docker image and available via the `exec` tool:",
  );
  lines.push("");
  lines.push("| Tool | Description |");
  lines.push("|------|-------------|");
  lines.push("| `ffmpeg` | Video/audio processing and editing |");
  lines.push("| `python3` | Python interpreter with pip and venv |");
  lines.push("| `jq` | JSON processor |");
  lines.push("| `psql` | PostgreSQL client |");
  lines.push("| `mysql` | MySQL client |");
  lines.push("| `redis-cli` | Redis client |");
  lines.push("| `gh` | GitHub CLI |");
  lines.push("| `kubectl` | Kubernetes CLI |");
  lines.push("| `aws` | AWS CLI v2 |");
  lines.push("| `az` | Azure CLI |");
  lines.push("| `terraform` | Infrastructure as code |");
  lines.push("| `thinkfleet skills search` | Skill management CLI |");
  lines.push("");
  lines.push("**Example - Edit video with ffmpeg:**");
  lines.push("```");
  lines.push(
    'exec command="ffmpeg -y -hide_banner -i video.mp4 -ss 00:01:00 -t 30 -c copy clip.mp4"',
  );
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Skills System");
  lines.push("");
  lines.push("Skills are markdown instruction files that extend the agent's knowledge.");
  lines.push("Over 300+ skills are available covering topics like:");
  lines.push("");
  lines.push("- **Cloud/DevOps:** AWS, Azure, GCP, Terraform, Kubernetes, Docker");
  lines.push("- **Development:** TypeScript, Python, Rust, React, testing, code review");
  lines.push("- **Video/Media:** FFmpeg video editor, video subtitles, image processing");
  lines.push("- **Productivity:** Gmail, Calendar, Slack, Linear, Notion, Obsidian");
  lines.push("- **APIs:** Stripe, Twilio, SendGrid, Shopify, and many more");
  lines.push("");
  lines.push("Skills are loaded automatically based on context or can be requested by the user.");
  lines.push("Use `skills list` to see available skills.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Usage Examples");
  lines.push("");
  lines.push('### User asks: "Read my emails from today"');
  lines.push("1. Check integrations: `saas action=integrations_list`");
  lines.push("2. Get Gmail token: `saas action=integrations_get_token appName=gmail`");
  lines.push("3. Use token with Gmail API");
  lines.push("");
  lines.push('### User asks: "Edit my config file"');
  lines.push('1. Load file tools: `load_tools({ categories: ["files"] })`');
  lines.push("2. Read the file: `read path=/path/to/config`");
  lines.push("3. Edit the file: `edit path=/path/to/config ...`");
  lines.push("");
  lines.push('### User asks: "Search the web for latest news"');
  lines.push('1. Load web tools: `load_tools({ categories: ["web"] })`');
  lines.push('2. Search: `web_search query="latest news"`');
  lines.push("");
  lines.push('### User asks: "Trim my video to the first 30 seconds"');
  lines.push('1. Load shell tools: `load_tools({ categories: ["shell"] })`');
  lines.push('2. Run ffmpeg: `exec command="ffmpeg -y -i video.mp4 -t 30 -c copy trimmed.mp4"`');
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`*This catalog is auto-generated from tool-categories.ts*`);
  lines.push("");

  return lines.join("\n");
}

// Main execution
const catalogContent = generateCatalog();
const outputPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../../docs/reference/templates/TOOLS_CATALOG.md",
);

// Ensure directory exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, catalogContent, "utf-8");

console.log(`Generated: ${outputPath}`);
console.log(`Categories: ${TOOL_CATEGORIES.length}`);
console.log(`Total tools: ${TOOL_CATEGORIES.reduce((sum, c) => sum + c.tools.length, 0)}`);
