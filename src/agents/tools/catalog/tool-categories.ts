/**
 * Tool Categories for Dynamic Tool Loading
 *
 * This file defines tool categories that can be loaded on-demand.
 * The agent starts with minimal tools and loads categories as needed.
 *
 * To regenerate TOOLS_CATALOG.md, run:
 *   npx tsx src/agents/tools/catalog/generate-catalog.ts
 *
 * Tool sources:
 * - Core coding tools: pi-coding-agent (read, write, edit, grep, find, ls)
 * - Bash tools: pi-tools.ts (exec, process, apply_patch)
 * - Thinkfleet tools: thinkfleet-tools.ts (browser, canvas, cron, message, etc.)
 * - Plugin tools: extensions/* (memory_*, voice_call, llm_task, lobster)
 * - Channel tools: channel-tools.ts (whatsapp_login, etc.)
 */

export type ToolCategory =
  | "core"
  | "files"
  | "shell"
  | "web"
  | "messaging"
  | "integrations"
  | "scheduling"
  | "media"
  | "memory"
  | "admin"
  | "voice"
  | "plugins";

export interface ToolCategoryDefinition {
  id: ToolCategory;
  label: string;
  description: string;
  useWhen: string;
  tools: string[];
  /** If true, these tools are always loaded (not dynamic) */
  alwaysLoaded?: boolean;
  /** If true, tools come from plugins and may not be available */
  pluginProvided?: boolean;
}

/**
 * Core tools - always available, minimal footprint
 */
export const CORE_TOOLS = ["read", "load_tools", "saas", "session_status"] as const;

/**
 * Tool category definitions
 *
 * Note: Tool availability depends on configuration and enabled plugins.
 * Some tools (marked with pluginProvided) require specific extensions to be installed.
 */
export const TOOL_CATEGORIES: ToolCategoryDefinition[] = [
  {
    id: "core",
    label: "Core",
    description: "Essential tools always available",
    useWhen: "Always loaded",
    tools: ["read", "load_tools", "saas", "session_status"],
    alwaysLoaded: true,
  },
  {
    id: "files",
    label: "File Operations",
    description: "Read, write, edit, and search files",
    useWhen: "User asks about files, code, documents, or needs file modifications",
    tools: ["write", "edit", "apply_patch", "grep", "find", "ls"],
  },
  {
    id: "shell",
    label: "Shell / Commands",
    description: "Execute shell commands and manage processes",
    useWhen: "User needs to run commands, scripts, install packages, or manage processes",
    tools: ["exec", "process"],
  },
  {
    id: "web",
    label: "Web Access",
    description: "Search the web, fetch URLs, and control browser",
    useWhen: "User needs current information, research, or content from websites",
    tools: ["web_search", "web_fetch", "browser"],
  },
  {
    id: "messaging",
    label: "Messaging",
    description: "Send messages, manage sessions, spawn sub-agents, and text-to-speech",
    useWhen: "User needs to contact someone, send notifications, or manage sub-agents",
    tools: [
      "message",
      "sessions_list",
      "sessions_history",
      "sessions_send",
      "sessions_spawn",
      "agents_list",
      "tts",
    ],
  },
  {
    id: "integrations",
    label: "Integrations (OAuth)",
    description: "Access connected services like Gmail, Google Drive, Slack, Calendar",
    useWhen: "User asks about email, Drive files, Slack messages, calendar events",
    tools: [], // These are accessed via the saas tool, not separate tools
  },
  {
    id: "scheduling",
    label: "Scheduling",
    description: "Create reminders, scheduled tasks, and cron jobs",
    useWhen: "User wants reminders, scheduled notifications, or recurring tasks",
    tools: ["cron"],
  },
  {
    id: "media",
    label: "Media / Images",
    description: "Analyze images, create visual content, and work with media",
    useWhen: "User shares images, screenshots, or asks for visual analysis",
    tools: ["image", "canvas"],
  },
  {
    id: "memory",
    label: "Memory",
    description: "Search and retrieve from long-term memory (requires memory-core plugin)",
    useWhen: "User asks about past conversations, preferences, or stored knowledge",
    tools: ["memory_search", "memory_get", "memory_categories"],
    pluginProvided: true,
  },
  {
    id: "admin",
    label: "Admin / Gateway",
    description: "System administration, node management, and file publishing",
    useWhen: "User asks to update, restart, or configure the agent",
    tools: ["gateway", "nodes", "publish_file"],
  },
  {
    id: "voice",
    label: "Voice Calls",
    description: "Make phone calls and voice conversations (requires voice-call plugin)",
    useWhen: "User wants to make a phone call or have a voice conversation",
    tools: ["voice_call"],
    pluginProvided: true,
  },
  {
    id: "plugins",
    label: "Plugin Tools",
    description: "Additional tools from installed plugins (llm_task, lobster, etc.)",
    useWhen: "User needs specialized plugin functionality",
    tools: ["llm_task", "lobster"],
    pluginProvided: true,
  },
];

/**
 * Get tools for a list of categories
 */
export function getToolsForCategories(categories: ToolCategory[]): string[] {
  const tools = new Set<string>();

  for (const category of categories) {
    const def = TOOL_CATEGORIES.find((c) => c.id === category);
    if (def) {
      for (const tool of def.tools) {
        tools.add(tool);
      }
    }
  }

  return Array.from(tools);
}

/**
 * Get all tool names across all categories
 */
export function getAllTools(): string[] {
  const tools = new Set<string>();
  for (const category of TOOL_CATEGORIES) {
    for (const tool of category.tools) {
      tools.add(tool);
    }
  }
  return Array.from(tools);
}

/**
 * Find which category a tool belongs to
 */
export function getCategoryForTool(toolName: string): ToolCategory | null {
  for (const category of TOOL_CATEGORIES) {
    if (category.tools.includes(toolName)) {
      return category.id;
    }
  }
  return null;
}
