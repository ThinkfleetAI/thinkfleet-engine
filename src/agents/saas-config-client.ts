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
      `[saas-config] Agent config loaded: name="${cachedConfig.name}", persona="${cachedConfig.personaId ?? "none"}"`,
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
 */
export async function applySaasAgentConfig(workspaceDir: string): Promise<void> {
  const config = await fetchAgentConfig();
  if (!config) return;

  const { setConfigOverride } = await import("../config/runtime-overrides.js");

  // Set identity name via runtime override so it flows through all channels
  if (config.name) {
    setConfigOverride("agents.list.0.identity.name", config.name);
  }

  // Set model via runtime override
  if (config.modelId) {
    const modelString = `${config.modelProvider}/${config.modelId}`;
    setConfigOverride("agents.defaults.model", modelString);
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
}

/**
 * Get the cached agent config (available after fetchAgentConfig has been called).
 */
export function getCachedAgentConfig(): SaasAgentConfig | null {
  return cachedConfig;
}
