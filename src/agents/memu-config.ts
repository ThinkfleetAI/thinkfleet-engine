import type { ThinkfleetConfig } from "../config/config.js";
import { resolveSessionAgentId } from "./agent-scope.js";

export type ResolvedMemuConfig = {
  enabled: boolean;
  baseUrl: string;
  autoMemorize: boolean;
  proactive: boolean;
  debounceMs: number;
};

const DEFAULTS: ResolvedMemuConfig = {
  enabled: false,
  baseUrl: "http://localhost:8230",
  autoMemorize: true,
  proactive: true,
  debounceMs: 5000,
};

export function resolveMemuConfig(
  cfg: ThinkfleetConfig | undefined,
  agentId?: string,
): ResolvedMemuConfig | null {
  if (!cfg) return null;
  // Check agent-level override first, then defaults
  const agents = (cfg as Record<string, unknown>).agents as
    | Record<string, Record<string, unknown>>
    | undefined;
  const agentCfg = agentId ? agents?.[agentId]?.memu : undefined;
  const defaultsCfg = agents?.defaults?.memu;
  const raw = (agentCfg ?? defaultsCfg) as Partial<ResolvedMemuConfig> | undefined;
  if (!raw?.enabled) return null;
  return {
    enabled: true,
    baseUrl: raw.baseUrl?.trim() || DEFAULTS.baseUrl,
    autoMemorize: raw.autoMemorize ?? DEFAULTS.autoMemorize,
    proactive: raw.proactive ?? DEFAULTS.proactive,
    debounceMs: raw.debounceMs ?? DEFAULTS.debounceMs,
  };
}

export function resolveMemuConfigForSession(params: {
  config?: ThinkfleetConfig;
  sessionKey?: string;
}): ResolvedMemuConfig | null {
  const agentId = resolveSessionAgentId({
    sessionKey: params.sessionKey,
    config: params.config,
  });
  return resolveMemuConfig(params.config, agentId);
}
