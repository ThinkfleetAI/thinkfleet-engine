import { Type } from "@sinclair/typebox";

import type { ThinkfleetConfig } from "../../config/config.js";
import { resolveMemuConfigForSession } from "../memu-config.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";

const MEMU_TIMEOUT_MS = 15_000;

async function memuFetch(baseUrl: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(MEMU_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MemU ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MemuMemorizeSchema = Type.Object({
  content: Type.String({ description: "Conversation text or event to memorize" }),
  user_id: Type.Optional(Type.String({ description: "User identifier for scoping memory" })),
  modality: Type.Optional(
    Type.String({ description: "Input type: conversation, document, image, video, audio" }),
  ),
});

const MemuRetrieveSchema = Type.Object({
  query: Type.String({ description: "Search query for hierarchical memory" }),
  user_id: Type.Optional(Type.String({ description: "User identifier for scoping retrieval" })),
  method: Type.Optional(
    Type.String({ description: "Retrieval method: 'rag' (fast) or 'llm' (deep reasoning)" }),
  ),
  max_results: Type.Optional(Type.Number({ description: "Max items to return" })),
});

const MemuStatusSchema = Type.Object({});

// ---------------------------------------------------------------------------
// Tool factories
// ---------------------------------------------------------------------------

export function createMemuMemorizeTool(options: {
  config?: ThinkfleetConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = resolveMemuConfigForSession({
    config: options.config,
    sessionKey: options.agentSessionKey,
  });
  if (!cfg) return null;
  return {
    label: "MemU Memorize",
    name: "memu_memorize",
    description:
      "Send conversation turns or events to MemU for hierarchical memory learning. " +
      "MemU extracts facts, preferences, and patterns into a three-layer memory hierarchy " +
      "(resources → items → categories) for long-term recall.",
    parameters: MemuMemorizeSchema,
    execute: async (_toolCallId, params) => {
      const content = readStringParam(params, "content", { required: true });
      const userId = readStringParam(params, "user_id") ?? "default";
      const modality = readStringParam(params, "modality") ?? "conversation";
      try {
        const result = await memuFetch(cfg.baseUrl, "/memorize", {
          content,
          user_id: userId,
          modality,
        });
        return jsonResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ ok: false, error: message });
      }
    },
  };
}

export function createMemuRetrieveTool(options: {
  config?: ThinkfleetConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = resolveMemuConfigForSession({
    config: options.config,
    sessionKey: options.agentSessionKey,
  });
  if (!cfg) return null;
  return {
    label: "MemU Retrieve",
    name: "memu_retrieve",
    description:
      "Query MemU's hierarchical memory for facts, preferences, and learned patterns. " +
      "Supports fast RAG-based retrieval or deep LLM-based reasoning. " +
      "Returns categorized memory items with relevance scores and anticipated follow-up context.",
    parameters: MemuRetrieveSchema,
    execute: async (_toolCallId, params) => {
      const query = readStringParam(params, "query", { required: true });
      const userId = readStringParam(params, "user_id") ?? "default";
      const method = readStringParam(params, "method") ?? "rag";
      const maxResults = readNumberParam(params, "max_results") ?? 10;
      try {
        const result = await memuFetch(cfg.baseUrl, "/retrieve", {
          query,
          user_id: userId,
          method,
          max_results: maxResults,
        });
        return jsonResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ ok: false, items: [], error: message });
      }
    },
  };
}

export function createMemuStatusTool(options: {
  config?: ThinkfleetConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = resolveMemuConfigForSession({
    config: options.config,
    sessionKey: options.agentSessionKey,
  });
  if (!cfg) return null;
  return {
    label: "MemU Status",
    name: "memu_status",
    description: "Check MemU sidecar health, storage backend, and memory statistics.",
    parameters: MemuStatusSchema,
    execute: async () => {
      try {
        const result = await memuFetch(cfg.baseUrl, "/status");
        return jsonResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ ok: false, error: message });
      }
    },
  };
}
