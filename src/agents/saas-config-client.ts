/**
 * SaaS Config Client
 *
 * On startup in SaaS mode, fetches the agent's name, persona system prompt,
 * and model settings from the SaaS backend. This ensures agents know their
 * identity and persona from the moment they boot.
 */

import fs from "node:fs";
import path from "node:path";
import { isSaasMode } from "./saas-credential-client.js";
import { getAccessToken } from "../saas/oauth-token-client.js";

export interface ReasoningOverrides {
  thinkingLevel?: string;
  blockStreaming?: boolean;
  heartbeatEnabled?: boolean;
  heartbeatInterval?: string;
}

export interface McpServerConfig {
  name: string;
  transport?: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  disabled?: boolean;
}

export type GuardrailMode = "auto_approve" | "ask_user" | "block";
export type GuardrailCategory = "file_ops" | "shell" | "web" | "desktop_automation" | "purchases";

export interface DocumentItem {
  id: string;
  filename: string;
  category: string;
  description: string | null;
  chunks: number;
  source?: "agent" | "org";
}

export interface DocumentSummary {
  count: number;
  categories: string[];
  items: DocumentItem[];
}

export interface SaasAgentConfig {
  name: string;
  systemPrompt: string | null;
  modelProvider: string;
  modelId: string | null;
  temperature: number;
  maxTokens: number;
  personaId: string | null;
  toolProfile: string;
  characterType: string;
  proxyBaseUrl: string | null;
  reasoningMode: boolean;
  reasoningOverrides: ReasoningOverrides | null;
  mcpServers?: McpServerConfig[];
  expertisePack?: string | null;
  /** Maximum concurrent tasks this agent can execute (from subscription plan) */
  maxConcurrentTasks: number;
  /** Super Bot mode: writable FS, full exec, persistent packages */
  developerMode: boolean;
  /** Observational memory: compress old messages into dense observations */
  observationalMemory?: boolean;
  /** Per-category guardrail policies from org admin */
  guardrailPolicies?: Record<GuardrailCategory, GuardrailMode>;
  /** Summary of available documents (agent-owned + org-assigned) */
  documents?: DocumentSummary | null;
}

const saasApiUrl = process.env.THINKFLEET_SAAS_API_URL;
const agentDbId = process.env.THINKFLEET_AGENT_DB_ID;

let cachedConfig: SaasAgentConfig | null = null;

const CONFIG_FETCH_MAX_RETRIES = 5;
const CONFIG_FETCH_RETRY_DELAYS = [2_000, 5_000, 10_000, 20_000, 30_000];

/**
 * Fetch agent config (name, persona, model settings) from the SaaS backend.
 * Retries with backoff if the SaaS service is not yet available (common during
 * cluster startup when bots boot before the socket service is ready).
 * Returns null if not in SaaS mode or if all retries fail.
 */
export async function fetchAgentConfig(): Promise<SaasAgentConfig | null> {
  if (!isSaasMode()) return null;
  if (cachedConfig) return cachedConfig;

  const url = `${saasApiUrl}/api/internal/agent-config/${agentDbId}`;

  for (let attempt = 0; attempt <= CONFIG_FETCH_MAX_RETRIES; attempt++) {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.error(
          `[saas-config] Failed to fetch agent config (attempt ${attempt + 1}): ${response.status} ${response.statusText}`,
        );
        if (attempt < CONFIG_FETCH_MAX_RETRIES) {
          const delay = CONFIG_FETCH_RETRY_DELAYS[attempt] ?? 30_000;
          console.log(`[saas-config] Retrying in ${delay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        return null;
      }

      cachedConfig = (await response.json()) as SaasAgentConfig;
      if (attempt > 0) {
        console.log(`[saas-config] Agent config loaded after ${attempt + 1} attempts`);
      }
      console.log(
        `[saas-config] Agent config loaded: name="${cachedConfig.name}", persona="${cachedConfig.personaId ?? "none"}", reasoning=${cachedConfig.reasoningMode}`,
      );
      return cachedConfig;
    } catch (error) {
      console.error(`[saas-config] Error fetching agent config (attempt ${attempt + 1}):`, error);
      if (attempt < CONFIG_FETCH_MAX_RETRIES) {
        const delay = CONFIG_FETCH_RETRY_DELAYS[attempt] ?? 30_000;
        console.log(`[saas-config] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[saas-config] All ${CONFIG_FETCH_MAX_RETRIES + 1} config fetch attempts failed`);
  return null;
}

/**
 * Apply fetched SaaS config to the running agent:
 * 1. Write persona system prompt to SOUL.md in workspace (if not already customized)
 * 2. Write agent name to IDENTITY.md
 * 3. Apply runtime config overrides for identity and model
 * 4. Apply reasoning mode config overrides + seed workspace files
 */
export async function applySaasAgentConfig(workspaceDir: string): Promise<void> {
  const config = await fetchAgentConfig();
  if (!config) return;

  // Ensure workspace directory exists before any file writes.
  // Individual file-write blocks call mkdirSync(path.dirname(...)) but if the
  // workspace root itself doesn't exist (e.g. K8s volume not yet mounted),
  // all writes fail with ENOENT. Creating it once here is more robust.
  try {
    fs.mkdirSync(workspaceDir, { recursive: true });
  } catch (err) {
    console.error(`[saas-config] Failed to create workspace directory ${workspaceDir}:`, err);
  }

  const { setConfigOverride } = await import("../config/runtime-overrides.js");

  // Set identity name via runtime override so it flows through all channels
  if (config.name) {
    setConfigOverride("agents.list.0.identity.name", config.name);
  }

  // Set model via runtime override (object form supports fallbacks for rate-limit resilience)
  // Always set a model override with fallbacks to handle rate limits gracefully
  const primaryModel = config.modelId
    ? `${config.modelProvider}/${config.modelId}`
    : `${config.modelProvider}/claude-sonnet-4-5`; // Default to Sonnet if no explicit model

  const modelOverride: { primary: string; fallbacks?: string[] } = {
    primary: primaryModel,
  };

  // Add cross-provider fallbacks for rate limit resilience.
  // Anthropic orgs often have low rate limits (30K tokens/min).
  // OpenAI typically has higher limits, so use it as a last resort.
  if (config.modelProvider === "anthropic") {
    modelOverride.fallbacks = [
      "anthropic/claude-sonnet-4-5", // Try Sonnet first (might work if Opus hit the limit)
      "anthropic/claude-haiku-3-5", // Haiku is cheaper and may have separate limit
      "openai/gpt-4o", // Cross-provider fallback
    ];
  } else if (config.modelProvider === "openai") {
    modelOverride.fallbacks = [
      "openai/gpt-4o-mini", // Cheaper OpenAI model
      "anthropic/claude-sonnet-4-5", // Cross-provider fallback
    ];
  }

  setConfigOverride("agents.defaults.model", modelOverride);

  console.log(
    `[saas-config] Model fallback chain: ${primaryModel} → ${modelOverride.fallbacks?.join(" → ") ?? "none"}`,
  );

  // Ensure prompt caching is enabled for Anthropic models.
  // applyContextPruningDefaults runs before runtime overrides, so the SaaS-configured
  // model doesn't get cacheControlTtl automatically. Set it explicitly here.
  if (config.modelProvider === "anthropic") {
    setConfigOverride("agents.defaults.models", {
      [primaryModel]: { params: { cacheControlTtl: "1h" } },
    });
  }

  // Set a global DM history limit to reduce token usage.
  // Without this, full conversation history is sent on every request, which can
  // consume 5-10K+ tokens on long sessions. 10 user turns is enough context
  // for continuity while keeping costs manageable across all providers.
  // Reduced from 15 to 10 for additional token savings (~2-3K per turn).
  setConfigOverride("agents.defaults.dmHistoryLimit", 10);

  // ============================================================================
  // TOKEN OPTIMIZATION: Cursor-style context reduction for SaaS agents
  // ============================================================================
  //
  // Reduce bootstrap file size limit from default 20K to 5K chars per file.
  // SaaS agents don't need massive context files - 5K is plenty for personas.
  // Savings: ~2-6K tokens when files are large.
  setConfigOverride("agents.defaults.bootstrapMaxChars", 5000);

  // Enable aggressive context pruning to trim old tool results earlier.
  // This is the single biggest win for long conversations - tool results
  // (file reads, grep outputs, exec results) can be huge and accumulate fast.
  //
  // Settings tuned for SaaS:
  // - Start soft trimming at 50% context (vs default 70%)
  // - Start hard clearing at 70% context (vs default 85%)
  // - Keep only last 3 assistant turns protected
  // - Trim tool results to 2K chars (500 head + 300 tail)
  setConfigOverride("agents.defaults.contextPruning", {
    mode: "cache-ttl",
    ttl: "5m",
    softTrimRatio: 0.5,
    hardClearRatio: 0.7,
    keepLastAssistants: 3,
    softTrim: {
      maxChars: 2000,
      headChars: 500,
      tailChars: 300,
    },
    hardClear: {
      enabled: true,
      placeholder: "[Tool result cleared to save context]",
    },
  });

  // Skip model aliases in system prompt - they add ~500 tokens and SaaS users
  // don't typically need to switch models via directives.
  setConfigOverride("agents.defaults.skipModelAliases", true);

  // Enable skills catalog mode: Inject compact catalog (~500 tokens) instead of
  // full skill content (~23K tokens). Agent reads SKILL.md on-demand when needed.
  setConfigOverride("agents.defaults.skillsCatalogMode", true);
  setConfigOverride("agents.defaults.maxSkillsPromptChars", 3000);

  console.log(
    "[saas-config] Token optimization enabled: bootstrapMaxChars=5000, dmHistoryLimit=10, contextPruning=aggressive, skipModelAliases=true, skillsCatalogMode=true",
  );

  // Apply reasoning mode config overrides
  if (config.reasoningMode) {
    const overrides = config.reasoningOverrides ?? {};
    const thinkingLevel = overrides.thinkingLevel ?? "medium";
    const blockStreaming = overrides.blockStreaming ?? true;
    const heartbeatEnabled = overrides.heartbeatEnabled ?? true;
    const heartbeatInterval = overrides.heartbeatInterval ?? "15m";

    setConfigOverride("agents.defaults.thinkingDefault", thinkingLevel);
    setConfigOverride("agents.defaults.blockStreamingDefault", blockStreaming ? "on" : "off");
    setConfigOverride("agents.defaults.blockStreamingBreak", "message_end");

    if (heartbeatEnabled) {
      setConfigOverride("agents.defaults.heartbeat", {
        every: heartbeatInterval,
        includeReasoning: true,
      });
    }

    setConfigOverride("agents.defaults.compaction", {
      memoryFlush: { enabled: true },
    });

    console.log(
      `[saas-config] Reasoning mode enabled: thinking=${thinkingLevel}, blockStreaming=${blockStreaming}, heartbeat=${heartbeatEnabled ? heartbeatInterval : "off"}`,
    );
  }

  // ============================================================================
  // OBSERVATIONAL MEMORY
  // ============================================================================
  if (config.observationalMemory) {
    setConfigOverride("agents.defaults.memorySearch.observational", {
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      observerThresholdTokens: 30000,
      reflectorThresholdTokens: 40000,
      debounceMs: 10000,
      maxObservationRatio: 0.4,
    });
    console.log("[saas-config] Observational memory enabled");
  }

  // ============================================================================
  // GUARDRAIL POLICIES (per-category exec approval enforcement)
  // ============================================================================
  if (config.guardrailPolicies) {
    const policies = config.guardrailPolicies;
    const os = await import("node:os");
    const guardrailsPath = path.join(os.homedir(), ".thinkfleet", "guardrail-policies.json");

    try {
      fs.mkdirSync(path.dirname(guardrailsPath), { recursive: true });
      fs.writeFileSync(guardrailsPath, JSON.stringify(policies, null, 2), { mode: 0o600 });
      console.log(`[saas-config] Wrote guardrail policies to ${guardrailsPath}`);
    } catch (error) {
      console.error("[saas-config] Error writing guardrail-policies.json:", error);
    }

    // Translate guardrail policies to exec approval settings:
    // - If shell is "auto_approve" → security=full, ask=off for shell commands
    // - If shell is "block" → security=none for shell commands
    // - If shell is "ask_user" → security=full, ask=always (default behavior)
    const shellPolicy = policies.shell ?? "ask_user";
    if (shellPolicy === "auto_approve") {
      setConfigOverride("tools.exec.security", "full");
      setConfigOverride("tools.exec.ask", "off");
    } else if (shellPolicy === "block") {
      setConfigOverride("tools.exec.security", "none");
    }
    // "ask_user" is the default — no override needed

    console.log(
      `[saas-config] Guardrail policies: ${Object.entries(policies)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  }

  // ============================================================================
  // SUPER BOT / DEVELOPER MODE
  // ============================================================================
  if (config.developerMode) {
    // Full exec access — no approval prompts, no allowlist restrictions
    setConfigOverride("tools.exec.security", "full");
    setConfigOverride("tools.exec.ask", "off");

    // Prepend user-space package bin dirs to PATH for the agent's exec tool
    setConfigOverride("tools.exec.pathPrepend", [
      "/home/node/.local/bin", // pip --user installs
      "/home/node/.npm-global/bin", // npm global installs
    ]);

    // Write exec-approvals.json with full access (consumed by exec-approvals subsystem)
    const os = await import("node:os");
    const approvalsPath = path.join(os.homedir(), ".thinkfleet", "exec-approvals.json");
    try {
      const approvals = {
        version: 1,
        defaults: {
          security: "full",
          ask: "off",
          autoAllowSkills: true,
        },
        agents: {},
      };
      fs.mkdirSync(path.dirname(approvalsPath), { recursive: true });
      fs.writeFileSync(approvalsPath, JSON.stringify(approvals, null, 2), { mode: 0o600 });
      console.log(`[saas-config] Wrote exec-approvals with full access to ${approvalsPath}`);
    } catch (error) {
      console.error("[saas-config] Error writing exec-approvals.json:", error);
    }

    // Write DEV_MODE.md to workspace with package installation guide
    const devModePath = path.join(workspaceDir, "DEV_MODE.md");
    try {
      const content = [
        "# Super Bot — Developer Mode",
        "",
        "This agent is running with Super Bot mode enabled. You have full developer autonomy.",
        "",
        "## Package Installation",
        "",
        "### System packages (apt-get) — persistent across restarts",
        "```bash",
        "dev-install <package1> [package2] ...   # Recommended: installs + records to manifest",
        "sudo apt-get install -y <package>       # Direct install (won't persist across restart)",
        "```",
        "",
        "### Python packages — persistent automatically",
        "```bash",
        "pip install <package>                   # Installs to ~/.local/ (PVC-backed)",
        "```",
        "",
        "### Node packages — persistent automatically",
        "```bash",
        "npm install -g <package>                # Installs to ~/.npm-global/ (PVC-backed)",
        "```",
        "",
        "## What Persists Across Restarts",
        "- pip packages (`~/.local/`) — automatic",
        "- npm global packages (`~/.npm-global/`) — automatic",
        "- apt packages — only if installed via `dev-install` (records to manifest, replayed on startup)",
        "- Everything in `~/.thinkfleet/` and workspace — automatic (PVC-backed)",
        "",
        "## Paths",
        "- User binaries: `~/.local/bin`, `~/.npm-global/bin` (on PATH)",
        "- Dev manifest: `~/.thinkfleet/dev-packages.json`",
        "",
      ].join("\n");
      fs.mkdirSync(path.dirname(devModePath), { recursive: true });
      fs.writeFileSync(devModePath, content, "utf-8");
      console.log(`[saas-config] Wrote developer mode guide to ${devModePath}`);
    } catch (error) {
      console.error("[saas-config] Error writing DEV_MODE.md:", error);
    }

    console.log(
      "[saas-config] Super Bot / developer mode enabled: full exec, user-space packages, writable FS",
    );
  }

  // Write persona system prompt to SOUL.md if the file doesn't exist or is the default template
  if (config.systemPrompt) {
    const soulPath = path.join(workspaceDir, "SOUL.md");
    try {
      let shouldWrite = false;

      if (!fs.existsSync(soulPath)) {
        shouldWrite = true;
      } else {
        const existing = fs.readFileSync(soulPath, "utf-8");
        // Only overwrite if it's the default template (contains the bootstrap marker)
        // or is empty. Don't overwrite user-customized SOUL.md files.
        if (
          existing.trim().length === 0 ||
          existing.includes("Be genuinely helpful, not performatively helpful")
        ) {
          shouldWrite = true;
        }
      }

      if (shouldWrite) {
        const content = [`# ${config.name}`, "", config.systemPrompt, ""].join("\n");
        fs.mkdirSync(path.dirname(soulPath), { recursive: true });
        fs.writeFileSync(soulPath, content, "utf-8");
        console.log(`[saas-config] Wrote persona system prompt to ${soulPath}`);
      }
    } catch (error) {
      console.error("[saas-config] Error writing SOUL.md:", error);
    }
  }

  // Write BOOTSTRAP.md with proxy URL and runtime context
  if (config.proxyBaseUrl) {
    const bootstrapPath = path.join(workspaceDir, "BOOTSTRAP.md");
    try {
      const content = [
        "# Runtime Environment",
        "",
        "## Accessing Local Services",
        "",
        "You are running inside a managed container. Users cannot access `localhost` URLs directly.",
        `When you start a local server (e.g., on port 3000), provide this URL pattern to users:`,
        "",
        `  ${config.proxyBaseUrl}/{port}/`,
        "",
        `For example, if you start a server on port 8080, the user can access it at:`,
        `  ${config.proxyBaseUrl}/8080/`,
        "",
        "NEVER share localhost or 127.0.0.1 URLs with users — they won't work.",
        "Always use the proxy URL pattern above instead.",
        "",
      ].join("\n");
      fs.mkdirSync(path.dirname(bootstrapPath), { recursive: true });
      fs.writeFileSync(bootstrapPath, content, "utf-8");
      console.log(`[saas-config] Wrote runtime context to ${bootstrapPath}`);
    } catch (error) {
      console.error("[saas-config] Error writing BOOTSTRAP.md:", error);
    }
  }

  // Write KNOWLEDGE.md with available documents so the bot knows what it can search
  const knowledgePath = path.join(workspaceDir, "KNOWLEDGE.md");
  if (config.documents && config.documents.count > 0) {
    try {
      const lines: string[] = [
        "# Available Knowledge",
        "",
        `You have access to ${config.documents.count} document(s) across categories: ${config.documents.categories.join(", ")}.`,
        "",
        "## Documents",
        "",
      ];

      for (const doc of config.documents.items) {
        const source = doc.source === "org" ? " (org)" : "";
        const desc = doc.description ? ` — ${doc.description}` : "";
        lines.push(`- **${doc.filename}**${source}: ${doc.category}${desc} (${doc.chunks} chunks)`);
      }

      lines.push(
        "",
        "## How to Access",
        "",
        "Use the `saas` tool with these actions to search documents:",
        "- `doc_search` — search agent-owned documents (requires: query, optional: limit)",
        "- `org_doc_search` — search org-level documents (requires: query, optional: limit)",
        "- `org_doc_list` — list all org documents (optional: category filter)",
        "",
        'Example: `saas(action="org_doc_search", query="resume work experience")`',
        "",
        "When a user asks about topics covered by these documents, proactively search them.",
        "",
      );

      fs.mkdirSync(path.dirname(knowledgePath), { recursive: true });
      fs.writeFileSync(knowledgePath, lines.join("\n"), "utf-8");
      console.log(
        `[saas-config] Wrote knowledge manifest (${config.documents.count} docs) to ${knowledgePath}`,
      );
    } catch (error) {
      console.error("[saas-config] Error writing KNOWLEDGE.md:", error);
    }
  } else {
    // Clean up stale KNOWLEDGE.md if no documents are available
    try {
      if (fs.existsSync(knowledgePath)) {
        fs.unlinkSync(knowledgePath);
      }
    } catch {
      /* ignore cleanup errors */
    }
  }

  // Write expertise pack to EXPERTISE.md (always overwrite — managed at persona level)
  const expertisePath = path.join(workspaceDir, "EXPERTISE.md");
  if (config.expertisePack) {
    try {
      const content = [`# Expertise Pack`, "", config.expertisePack, ""].join("\n");
      fs.mkdirSync(path.dirname(expertisePath), { recursive: true });
      fs.writeFileSync(expertisePath, content, "utf-8");
      console.log(`[saas-config] Wrote expertise pack to ${expertisePath}`);
    } catch (error) {
      console.error("[saas-config] Error writing EXPERTISE.md:", error);
    }
  } else {
    // Clean up stale EXPERTISE.md if persona no longer has an expertise pack
    try {
      if (fs.existsSync(expertisePath)) {
        fs.unlinkSync(expertisePath);
        console.log(`[saas-config] Removed stale EXPERTISE.md`);
      }
    } catch {
      /* ignore cleanup errors */
    }
  }

  // Write agent name to IDENTITY.md if it doesn't exist or is the default template
  const identityPath = path.join(workspaceDir, "IDENTITY.md");
  if (config.name) {
    try {
      let shouldWrite = false;

      if (!fs.existsSync(identityPath)) {
        shouldWrite = true;
      } else {
        const existing = fs.readFileSync(identityPath, "utf-8");
        if (existing.trim().length === 0 || existing.includes("(not yet chosen)")) {
          shouldWrite = true;
        }
      }

      if (shouldWrite) {
        const content = [
          "# Identity",
          "",
          `name: ${config.name}`,
          `persona: ${config.personaId ?? "general"}`,
          `character: ${config.characterType ?? "default"}`,
          "",
        ].join("\n");
        fs.mkdirSync(path.dirname(identityPath), { recursive: true });
        fs.writeFileSync(identityPath, content, "utf-8");
        console.log(`[saas-config] Wrote identity to ${identityPath}`);
      }
    } catch (error) {
      console.error("[saas-config] Error writing IDENTITY.md:", error);
    }
  }

  // Seed reasoning workspace files when reasoning mode is enabled
  if (config.reasoningMode) {
    seedReasoningWorkspaceFiles(workspaceDir);
  }

  // Apply MCP server config from SaaS
  if (config.mcpServers && config.mcpServers.length > 0) {
    // Convert SaaS MCP config format to bot's McpServerConfig format
    const mcpServers = config.mcpServers
      .filter((s) => s.command && !s.disabled) // Only include enabled stdio servers with commands
      .map((s) => ({
        id: s.name,
        transport: "stdio" as const,
        command: s.command!,
        args: s.args,
        env: s.env,
      }));

    if (mcpServers.length > 0) {
      setConfigOverride("mcp.servers", mcpServers);
      console.log(
        `[saas-config] MCP servers configured: ${mcpServers.map((s) => s.id).join(", ")}`,
      );
    }
  }
}

/**
 * Seed HEARTBEAT.md and TASKS.md workspace files for reasoning mode.
 * Only writes if the files don't already exist (preserves user customizations).
 */
function seedReasoningWorkspaceFiles(workspaceDir: string): void {
  // Seed HEARTBEAT.md with task-review instructions
  const heartbeatPath = path.join(workspaceDir, "HEARTBEAT.md");
  try {
    if (!fs.existsSync(heartbeatPath)) {
      const content = [
        "# Heartbeat Protocol",
        "",
        "When this file exists, periodic heartbeats will review your current state.",
        "",
        "## On each heartbeat:",
        "1. Read TASKS.md for pending items",
        "2. Review any in-progress work",
        "3. If a task is stale or blocked, update its status",
        "4. If nothing needs attention, reply HEARTBEAT_OK",
        "",
        "## Guidelines:",
        "- Do NOT infer tasks from prior conversations",
        "- Only act on items explicitly listed in TASKS.md",
        "- Keep status updates concise",
        "",
      ].join("\n");
      fs.mkdirSync(path.dirname(heartbeatPath), { recursive: true });
      fs.writeFileSync(heartbeatPath, content, "utf-8");
      console.log(`[saas-config] Seeded heartbeat protocol to ${heartbeatPath}`);
    }
  } catch (error) {
    console.error("[saas-config] Error writing HEARTBEAT.md:", error);
  }

  // Seed TASKS.md with inbox/active/done structure
  const tasksPath = path.join(workspaceDir, "TASKS.md");
  try {
    if (!fs.existsSync(tasksPath)) {
      const content = [
        "# Tasks",
        "",
        "## Inbox",
        "<!-- New tasks go here -->",
        "",
        "## Active",
        "<!-- Tasks currently being worked on -->",
        "",
        "## Done",
        "<!-- Completed tasks -->",
        "",
      ].join("\n");
      fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
      fs.writeFileSync(tasksPath, content, "utf-8");
      console.log(`[saas-config] Seeded task structure to ${tasksPath}`);
    }
  } catch (error) {
    console.error("[saas-config] Error writing TASKS.md:", error);
  }
}

/**
 * Get the cached agent config (available after fetchAgentConfig has been called).
 */
export function getCachedAgentConfig(): SaasAgentConfig | null {
  return cachedConfig;
}

/**
 * Read guardrail policies from the cached config or the on-disk file.
 * Returns the policy map or null if not available.
 */
export function getGuardrailPolicies(): Record<GuardrailCategory, GuardrailMode> | null {
  // Prefer cached config
  if (cachedConfig?.guardrailPolicies) {
    return cachedConfig.guardrailPolicies;
  }

  // Fall back to on-disk file
  try {
    const os = require("node:os");
    const guardrailsPath = path.join(os.homedir(), ".thinkfleet", "guardrail-policies.json");
    if (fs.existsSync(guardrailsPath)) {
      return JSON.parse(fs.readFileSync(guardrailsPath, "utf-8"));
    }
  } catch {
    // ignore read errors
  }

  return null;
}

/**
 * Check if a specific guardrail category should block execution entirely.
 */
export function isGuardrailBlocked(category: GuardrailCategory): boolean {
  const policies = getGuardrailPolicies();
  if (!policies) return false;
  return policies[category] === "block";
}

/**
 * Check if a specific guardrail category requires user approval.
 */
export function isGuardrailAskUser(category: GuardrailCategory): boolean {
  const policies = getGuardrailPolicies();
  if (!policies) return true; // Default to asking
  return policies[category] === "ask_user";
}

/**
 * Check if a specific guardrail category is auto-approved.
 */
export function isGuardrailAutoApproved(category: GuardrailCategory): boolean {
  const policies = getGuardrailPolicies();
  if (!policies) return false;
  return policies[category] === "auto_approve";
}
