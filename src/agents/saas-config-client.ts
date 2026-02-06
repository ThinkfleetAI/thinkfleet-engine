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

export interface ReasoningOverrides {
  thinkingLevel?: string;
  blockStreaming?: boolean;
  heartbeatEnabled?: boolean;
  heartbeatInterval?: string;
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
}

const saasApiUrl = process.env.THINKFLEET_SAAS_API_URL;
const agentDbId = process.env.THINKFLEET_AGENT_DB_ID;
const gatewayToken = process.env.THINKFLEET_GATEWAY_TOKEN;

let cachedConfig: SaasAgentConfig | null = null;

/**
 * Fetch agent config (name, persona, model settings) from the SaaS backend.
 * Returns null if not in SaaS mode or if the fetch fails.
 */
export async function fetchAgentConfig(): Promise<SaasAgentConfig | null> {
  if (!isSaasMode()) return null;
  if (cachedConfig) return cachedConfig;

  try {
    const url = `${saasApiUrl}/api/internal/agent-config/${agentDbId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${gatewayToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(
        `[saas-config] Failed to fetch agent config: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    cachedConfig = (await response.json()) as SaasAgentConfig;
    console.log(
      `[saas-config] Agent config loaded: name="${cachedConfig.name}", persona="${cachedConfig.personaId ?? "none"}", reasoning=${cachedConfig.reasoningMode}`,
    );
    return cachedConfig;
  } catch (error) {
    console.error("[saas-config] Error fetching agent config:", error);
    return null;
  }
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

  // Reduce max skills prompt size to 3K chars (default is much larger).
  // Skills prompts list all available skills and can be 5-10K tokens.
  setConfigOverride("agents.defaults.maxSkillsPromptChars", 3000);

  console.log(
    "[saas-config] Token optimization enabled: bootstrapMaxChars=5000, dmHistoryLimit=10, contextPruning=aggressive, skipModelAliases=true",
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
