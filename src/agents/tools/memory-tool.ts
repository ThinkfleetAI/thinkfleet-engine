import { Type } from "@sinclair/typebox";

import type { ThinkfleetConfig } from "../../config/config.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { resolveMemorySearchConfig } from "../memory-search.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

const MemorySearchSchema = Type.Object({
  query: Type.String(),
  maxResults: Type.Optional(Type.Number()),
  minScore: Type.Optional(Type.Number()),
  memory_type: Type.Optional(
    Type.Union([
      Type.Literal("profile"),
      Type.Literal("event"),
      Type.Literal("knowledge"),
      Type.Literal("behavior"),
      Type.Literal("skill"),
    ]),
  ),
  category: Type.Optional(Type.String()),
});

const MemoryGetSchema = Type.Object({
  path: Type.String(),
  from: Type.Optional(Type.Number()),
  lines: Type.Optional(Type.Number()),
});

export function createMemorySearchTool(options: {
  config?: ThinkfleetConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) return null;
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  if (!resolveMemorySearchConfig(cfg, agentId)) return null;
  return {
    label: "Memory Search",
    name: "memory_search",
    description:
      "Mandatory recall step: semantically search MEMORY.md + memory/*.md (and optional session transcripts and extracted memories) before answering questions about prior work, decisions, dates, people, preferences, or todos; returns top snippets with path + lines. Use memory_type or category filters to narrow results to specific kinds of memories.",
    parameters: MemorySearchSchema,
    execute: async (_toolCallId, params) => {
      const query = readStringParam(params, "query", { required: true });
      const maxResults = readNumberParam(params, "maxResults");
      const minScore = readNumberParam(params, "minScore");
      const memoryType = readStringParam(params, "memory_type") as
        | "profile"
        | "event"
        | "knowledge"
        | "behavior"
        | "skill"
        | undefined;
      const category = readStringParam(params, "category");
      const { manager, error } = await getMemorySearchManager({
        cfg,
        agentId,
      });
      if (!manager) {
        return jsonResult({ results: [], disabled: true, error });
      }
      try {
        // Search file chunks (existing behavior)
        const results = await manager.search(query, {
          maxResults,
          minScore,
          sessionKey: options.agentSessionKey,
        });

        // Also search extracted memory items
        let memoryItems: unknown[] = [];
        try {
          const items = await manager.searchMemoryItems({
            query,
            memoryType: memoryType || undefined,
            category: category || undefined,
            maxResults: maxResults ?? 5,
            minScore: minScore ?? 0.3,
          });
          memoryItems = items.map((item) => ({
            type: "memory",
            memory_type: item.memory_type,
            category: item.category,
            content: item.content,
            importance: item.importance,
            score: item.score,
          }));
        } catch {
          // Memory items may not be available yet
        }

        const status = manager.status();
        return jsonResult({
          results,
          memory_items: memoryItems,
          provider: status.provider,
          model: status.model,
          fallback: status.fallback,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ results: [], disabled: true, error: message });
      }
    },
  };
}

export function createMemoryCategoriesTool(options: {
  config?: ThinkfleetConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) return null;
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  if (!resolveMemorySearchConfig(cfg, agentId)) return null;
  return {
    label: "Memory Categories",
    name: "memory_categories",
    description:
      "List all memory categories with their summaries and item counts. Use this to understand what kinds of memories are available before searching.",
    parameters: Type.Object({}),
    execute: async () => {
      const { manager, error } = await getMemorySearchManager({
        cfg,
        agentId,
      });
      if (!manager) {
        return jsonResult({ categories: [], disabled: true, error });
      }
      try {
        const categories = manager.listCategories();
        return jsonResult({ categories });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ categories: [], disabled: true, error: message });
      }
    },
  };
}

export function createMemoryGetTool(options: {
  config?: ThinkfleetConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) return null;
  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });
  if (!resolveMemorySearchConfig(cfg, agentId)) return null;
  return {
    label: "Memory Get",
    name: "memory_get",
    description:
      "Safe snippet read from MEMORY.md or memory/*.md with optional from/lines; use after memory_search to pull only the needed lines and keep context small.",
    parameters: MemoryGetSchema,
    execute: async (_toolCallId, params) => {
      const relPath = readStringParam(params, "path", { required: true });
      const from = readNumberParam(params, "from", { integer: true });
      const lines = readNumberParam(params, "lines", { integer: true });
      const { manager, error } = await getMemorySearchManager({
        cfg,
        agentId,
      });
      if (!manager) {
        return jsonResult({ path: relPath, text: "", disabled: true, error });
      }
      try {
        const result = await manager.readFile({
          relPath,
          from: from ?? undefined,
          lines: lines ?? undefined,
        });
        return jsonResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ path: relPath, text: "", disabled: true, error: message });
      }
    },
  };
}
