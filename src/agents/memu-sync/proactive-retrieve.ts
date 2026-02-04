/**
 * MemU Proactive Retrieval — Automatically fetches relevant memories
 * before agent execution so the agent has personalized context without
 * the user (or the agent) needing to explicitly request it.
 *
 * Called from agent-runner.ts after memory flush, before the agent turn.
 * Returns a formatted context block to prepend to the user's message.
 *
 * Uses the /anticipate endpoint (optimized for proactive context injection)
 * with a fallback to /retrieve if the endpoint is unavailable.
 */

import { logVerbose } from "../../globals.js";
import type { ResolvedMemuConfig } from "../memu-config.js";

const PROACTIVE_TIMEOUT_MS = 5_000;
const MIN_RELEVANCE_SCORE = 0.4;
const MAX_PROACTIVE_ITEMS = 5;
const MAX_CONTEXT_CHARS = 2000;

type MemoryItem = {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
};

type AnticipateResponse = {
  ok: boolean;
  items: MemoryItem[];
  context_block: string;
  query: string;
};

type RetrieveResponse = {
  ok: boolean;
  items: MemoryItem[];
  method: string;
  query: string;
};

/**
 * Proactively retrieve relevant memories for the user's current message.
 * Returns a formatted context string to prepend, or empty string if nothing relevant.
 */
export async function proactiveMemuRetrieve(params: {
  config: ResolvedMemuConfig;
  userMessage: string;
  userId?: string;
}): Promise<string> {
  const { config, userMessage, userId } = params;

  if (!config.enabled || !config.proactive) return "";

  // Skip very short messages — not enough signal for meaningful retrieval
  const trimmed = userMessage.trim();
  if (trimmed.length < 10) return "";

  // Skip obvious commands/resets
  if (trimmed.startsWith("/") || trimmed.startsWith("!")) return "";

  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  // Try /anticipate first (returns pre-formatted context_block)
  try {
    const result = await tryAnticipateEndpoint(baseUrl, trimmed, userId);
    if (result) return result;
  } catch {
    // Fall through to /retrieve
  }

  // Fallback to /retrieve with client-side formatting
  try {
    return await fallbackRetrieve(baseUrl, trimmed, userId);
  } catch (err) {
    logVerbose(`[memu-proactive] retrieval failed: ${String(err)}`);
    return "";
  }
}

async function tryAnticipateEndpoint(
  baseUrl: string,
  query: string,
  userId?: string,
): Promise<string | null> {
  const response = await fetch(`${baseUrl}/anticipate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      user_id: userId ?? "default",
      max_results: MAX_PROACTIVE_ITEMS,
      min_score: MIN_RELEVANCE_SCORE,
    }),
    signal: AbortSignal.timeout(PROACTIVE_TIMEOUT_MS),
  });

  if (!response.ok) {
    if (response.status === 404) return null; // Endpoint not available, use fallback
    logVerbose(`[memu-proactive] /anticipate returned ${response.status}`);
    return null;
  }

  const data = (await response.json()) as AnticipateResponse;
  if (!data.ok || !data.context_block) return null;

  return data.context_block;
}

async function fallbackRetrieve(baseUrl: string, query: string, userId?: string): Promise<string> {
  const response = await fetch(`${baseUrl}/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      user_id: userId ?? "default",
      method: "rag",
      max_results: MAX_PROACTIVE_ITEMS,
    }),
    signal: AbortSignal.timeout(PROACTIVE_TIMEOUT_MS),
  });

  if (!response.ok) {
    logVerbose(`[memu-proactive] /retrieve returned ${response.status}`);
    return "";
  }

  const data = (await response.json()) as RetrieveResponse;
  if (!data.ok || !data.items || data.items.length === 0) return "";

  const relevant = data.items.filter((item) => item.score >= MIN_RELEVANCE_SCORE);
  if (relevant.length === 0) return "";

  return formatMemoryContext(relevant);
}

function formatMemoryContext(items: MemoryItem[]): string {
  const parts: string[] = [];
  let totalChars = 0;

  for (const item of items) {
    const memType = (item.metadata?.memory_type as string) ?? "memory";
    const line = `- [${memType}] ${item.content}`;

    if (totalChars + line.length > MAX_CONTEXT_CHARS) break;

    parts.push(line);
    totalChars += line.length;
  }

  if (parts.length === 0) return "";

  return [
    "[Memory context — relevant information recalled from previous interactions]",
    ...parts,
    "[End memory context]",
  ].join("\n");
}
