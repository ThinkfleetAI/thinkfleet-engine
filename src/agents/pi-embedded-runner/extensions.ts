import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Api, Model } from "@mariozechner/pi-ai";
import type { SessionManager } from "@mariozechner/pi-coding-agent";

import type { ThinkfleetConfig } from "../../config/config.js";
import { ObservationStore } from "../../memory/observational/store.js";
import { startObservationalWorker } from "../../memory/observational/worker.js";
import { resolveContextWindowInfo } from "../context-window-guard.js";
import { DEFAULT_CONTEXT_TOKENS } from "../defaults.js";
import { resolveMemorySearchConfig } from "../memory-search.js";
import { setCompactionSafeguardRuntime } from "../pi-extensions/compaction-safeguard-runtime.js";
import { setContextPruningRuntime } from "../pi-extensions/context-pruning/runtime.js";
import { computeEffectiveSettings } from "../pi-extensions/context-pruning/settings.js";
import { makeToolPrunablePredicate } from "../pi-extensions/context-pruning/tools.js";
import { setObservationalMemoryRuntime } from "../pi-extensions/observational-memory/runtime.js";
import { ensurePiCompactionReserveTokens } from "../pi-settings.js";
import { isCacheTtlEligibleProvider, readLastCacheTtlTimestamp } from "./cache-ttl.js";

function resolvePiExtensionPath(id: string): string {
  const self = fileURLToPath(import.meta.url);
  const dir = path.dirname(self);
  // In dev this file is `.ts` (tsx), in production it's `.js`.
  const ext = path.extname(self) === ".ts" ? "ts" : "js";
  return path.join(dir, "..", "pi-extensions", `${id}.${ext}`);
}

function resolveContextWindowTokens(params: {
  cfg: ThinkfleetConfig | undefined;
  provider: string;
  modelId: string;
  model: Model<Api> | undefined;
}): number {
  return resolveContextWindowInfo({
    cfg: params.cfg,
    provider: params.provider,
    modelId: params.modelId,
    modelContextWindow: params.model?.contextWindow,
    defaultTokens: DEFAULT_CONTEXT_TOKENS,
  }).tokens;
}

function buildContextPruningExtension(params: {
  cfg: ThinkfleetConfig | undefined;
  sessionManager: SessionManager;
  provider: string;
  modelId: string;
  model: Model<Api> | undefined;
}): { additionalExtensionPaths?: string[] } {
  const raw = params.cfg?.agents?.defaults?.contextPruning;
  if (raw?.mode !== "cache-ttl") return {};
  if (!isCacheTtlEligibleProvider(params.provider, params.modelId)) return {};

  const settings = computeEffectiveSettings(raw);
  if (!settings) return {};

  setContextPruningRuntime(params.sessionManager, {
    settings,
    contextWindowTokens: resolveContextWindowTokens(params),
    isToolPrunable: makeToolPrunablePredicate(settings.tools),
    lastCacheTouchAt: readLastCacheTtlTimestamp(params.sessionManager),
  });

  return {
    additionalExtensionPaths: [resolvePiExtensionPath("context-pruning")],
  };
}

function buildObservationalMemoryExtension(params: {
  cfg: ThinkfleetConfig | undefined;
  sessionManager: SessionManager;
  agentId?: string;
  sessionKey?: string;
}): { additionalExtensionPaths?: string[] } {
  if (!params.cfg || !params.agentId) return {};

  const memConfig = resolveMemorySearchConfig(params.cfg, params.agentId);
  if (!memConfig?.observational?.enabled) return {};

  const observational = memConfig.observational;
  const storePath = memConfig.store.path;
  const sessionKey = params.sessionKey ?? "default";

  const store = new ObservationStore(storePath);
  const workerHandle = startObservationalWorker({
    store,
    config: observational,
    cfg: params.cfg,
    sessionKey,
  });

  setObservationalMemoryRuntime(params.sessionManager, {
    store,
    sessionKey,
    maxObservationRatio: observational.maxObservationRatio,
    workerHandle,
  });

  return {
    additionalExtensionPaths: [resolvePiExtensionPath("observational-memory")],
  };
}

function resolveCompactionMode(cfg?: ThinkfleetConfig): "default" | "safeguard" {
  return cfg?.agents?.defaults?.compaction?.mode === "safeguard" ? "safeguard" : "default";
}

export function buildEmbeddedExtensionPaths(params: {
  cfg: ThinkfleetConfig | undefined;
  sessionManager: SessionManager;
  provider: string;
  modelId: string;
  model: Model<Api> | undefined;
  agentId?: string;
  sessionKey?: string;
}): string[] {
  const paths: string[] = [];

  // Always register transcript-repair: final safety net that ensures tool_use /
  // tool_result pairing is valid right before the API call, catching corruption
  // from auto-compaction, context pruning, or any other mid-pipeline transform.
  paths.push(resolvePiExtensionPath("transcript-repair"));

  if (resolveCompactionMode(params.cfg) === "safeguard") {
    const compactionCfg = params.cfg?.agents?.defaults?.compaction;
    setCompactionSafeguardRuntime(params.sessionManager, {
      maxHistoryShare: compactionCfg?.maxHistoryShare,
    });
    paths.push(resolvePiExtensionPath("compaction-safeguard"));
  }

  // Observational memory: replace observed messages with compressed observations.
  // Registered BEFORE context-pruning so OM reduces message count first,
  // then pruning trims remaining tool results.
  const observational = buildObservationalMemoryExtension(params);
  if (observational.additionalExtensionPaths) {
    paths.push(...observational.additionalExtensionPaths);
  }

  const pruning = buildContextPruningExtension(params);
  if (pruning.additionalExtensionPaths) {
    paths.push(...pruning.additionalExtensionPaths);
  }
  return paths;
}

export { ensurePiCompactionReserveTokens };
