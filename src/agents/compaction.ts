import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { estimateTokens, generateSummary } from "@mariozechner/pi-coding-agent";

import { DEFAULT_CONTEXT_TOKENS } from "./defaults.js";

export const BASE_CHUNK_RATIO = 0.4;
export const MIN_CHUNK_RATIO = 0.15;
export const SAFETY_MARGIN = 1.2; // 20% buffer for estimateTokens() inaccuracy
const DEFAULT_SUMMARY_FALLBACK = "No prior history.";
const DEFAULT_PARTS = 2;
const MERGE_SUMMARIES_INSTRUCTIONS =
  "Merge these partial summaries into a single cohesive summary. Preserve decisions," +
  " TODOs, open questions, and any constraints.";

export function estimateMessagesTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message), 0);
}

function normalizeParts(parts: number, messageCount: number): number {
  if (!Number.isFinite(parts) || parts <= 1) return 1;
  return Math.min(Math.max(1, Math.floor(parts)), Math.max(1, messageCount));
}

export function splitMessagesByTokenShare(
  messages: AgentMessage[],
  parts = DEFAULT_PARTS,
): AgentMessage[][] {
  if (messages.length === 0) return [];
  const normalizedParts = normalizeParts(parts, messages.length);
  if (normalizedParts <= 1) return [messages];

  const totalTokens = estimateMessagesTokens(messages);
  const targetTokens = totalTokens / normalizedParts;
  const chunks: AgentMessage[][] = [];
  let current: AgentMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const messageTokens = estimateTokens(message);
    if (
      chunks.length < normalizedParts - 1 &&
      current.length > 0 &&
      currentTokens + messageTokens > targetTokens
    ) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(message);
    currentTokens += messageTokens;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export function chunkMessagesByMaxTokens(
  messages: AgentMessage[],
  maxTokens: number,
): AgentMessage[][] {
  if (messages.length === 0) return [];

  const chunks: AgentMessage[][] = [];
  let currentChunk: AgentMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const messageTokens = estimateTokens(message);
    if (currentChunk.length > 0 && currentTokens + messageTokens > maxTokens) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(message);
    currentTokens += messageTokens;

    if (messageTokens > maxTokens) {
      // Split oversized messages to avoid unbounded chunk growth.
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Compute adaptive chunk ratio based on average message size.
 * When messages are large, we use smaller chunks to avoid exceeding model limits.
 */
export function computeAdaptiveChunkRatio(messages: AgentMessage[], contextWindow: number): number {
  if (messages.length === 0) return BASE_CHUNK_RATIO;

  const totalTokens = estimateMessagesTokens(messages);
  const avgTokens = totalTokens / messages.length;

  // Apply safety margin to account for estimation inaccuracy
  const safeAvgTokens = avgTokens * SAFETY_MARGIN;
  const avgRatio = safeAvgTokens / contextWindow;

  // If average message is > 10% of context, reduce chunk ratio
  if (avgRatio > 0.1) {
    const reduction = Math.min(avgRatio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO);
    return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
  }

  return BASE_CHUNK_RATIO;
}

/**
 * Check if a single message is too large to summarize.
 * If single message > 50% of context, it can't be summarized safely.
 */
export function isOversizedForSummary(msg: AgentMessage, contextWindow: number): boolean {
  const tokens = estimateTokens(msg) * SAFETY_MARGIN;
  return tokens > contextWindow * 0.5;
}

async function summarizeChunks(params: {
  messages: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  apiKey: string;
  signal: AbortSignal;
  reserveTokens: number;
  maxChunkTokens: number;
  customInstructions?: string;
  previousSummary?: string;
}): Promise<string> {
  if (params.messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  const chunks = chunkMessagesByMaxTokens(params.messages, params.maxChunkTokens);
  let summary = params.previousSummary;

  for (const chunk of chunks) {
    summary = await generateSummary(
      chunk,
      params.model,
      params.reserveTokens,
      params.apiKey,
      params.signal,
      params.customInstructions,
      summary,
    );
  }

  return summary ?? DEFAULT_SUMMARY_FALLBACK;
}

/**
 * Summarize with progressive fallback for handling oversized messages.
 * If full summarization fails, tries partial summarization excluding oversized messages.
 */
export async function summarizeWithFallback(params: {
  messages: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  apiKey: string;
  signal: AbortSignal;
  reserveTokens: number;
  maxChunkTokens: number;
  contextWindow: number;
  customInstructions?: string;
  previousSummary?: string;
}): Promise<string> {
  const { messages, contextWindow } = params;

  if (messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  // Try full summarization first
  try {
    return await summarizeChunks(params);
  } catch (fullError) {
    console.warn(
      `Full summarization failed, trying partial: ${
        fullError instanceof Error ? fullError.message : String(fullError)
      }`,
    );
  }

  // Fallback 1: Summarize only small messages, note oversized ones
  const smallMessages: AgentMessage[] = [];
  const oversizedNotes: string[] = [];

  for (const msg of messages) {
    if (isOversizedForSummary(msg, contextWindow)) {
      const role = (msg as { role?: string }).role ?? "message";
      const tokens = estimateTokens(msg);
      oversizedNotes.push(
        `[Large ${role} (~${Math.round(tokens / 1000)}K tokens) omitted from summary]`,
      );
    } else {
      smallMessages.push(msg);
    }
  }

  if (smallMessages.length > 0) {
    try {
      const partialSummary = await summarizeChunks({
        ...params,
        messages: smallMessages,
      });
      const notes = oversizedNotes.length > 0 ? `\n\n${oversizedNotes.join("\n")}` : "";
      return partialSummary + notes;
    } catch (partialError) {
      console.warn(
        `Partial summarization also failed: ${
          partialError instanceof Error ? partialError.message : String(partialError)
        }`,
      );
    }
  }

  // Final fallback: Just note what was there
  return (
    `Context contained ${messages.length} messages (${oversizedNotes.length} oversized). ` +
    `Summary unavailable due to size limits.`
  );
}

export async function summarizeInStages(params: {
  messages: AgentMessage[];
  model: NonNullable<ExtensionContext["model"]>;
  apiKey: string;
  signal: AbortSignal;
  reserveTokens: number;
  maxChunkTokens: number;
  contextWindow: number;
  customInstructions?: string;
  previousSummary?: string;
  parts?: number;
  minMessagesForSplit?: number;
}): Promise<string> {
  const { messages } = params;
  if (messages.length === 0) {
    return params.previousSummary ?? DEFAULT_SUMMARY_FALLBACK;
  }

  const minMessagesForSplit = Math.max(2, params.minMessagesForSplit ?? 4);
  const parts = normalizeParts(params.parts ?? DEFAULT_PARTS, messages.length);
  const totalTokens = estimateMessagesTokens(messages);

  if (parts <= 1 || messages.length < minMessagesForSplit || totalTokens <= params.maxChunkTokens) {
    return summarizeWithFallback(params);
  }

  const splits = splitMessagesByTokenShare(messages, parts).filter((chunk) => chunk.length > 0);
  if (splits.length <= 1) {
    return summarizeWithFallback(params);
  }

  const partialSummaries: string[] = [];
  for (const chunk of splits) {
    partialSummaries.push(
      await summarizeWithFallback({
        ...params,
        messages: chunk,
        previousSummary: undefined,
      }),
    );
  }

  if (partialSummaries.length === 1) {
    return partialSummaries[0];
  }

  const summaryMessages: AgentMessage[] = partialSummaries.map((summary) => ({
    role: "user",
    content: summary,
    timestamp: Date.now(),
  }));

  const mergeInstructions = params.customInstructions
    ? `${MERGE_SUMMARIES_INSTRUCTIONS}\n\nAdditional focus:\n${params.customInstructions}`
    : MERGE_SUMMARIES_INSTRUCTIONS;

  return summarizeWithFallback({
    ...params,
    messages: summaryMessages,
    customInstructions: mergeInstructions,
  });
}

export function pruneHistoryForContextShare(params: {
  messages: AgentMessage[];
  maxContextTokens: number;
  maxHistoryShare?: number;
  parts?: number;
}): {
  messages: AgentMessage[];
  droppedMessagesList: AgentMessage[];
  droppedChunks: number;
  droppedMessages: number;
  droppedTokens: number;
  keptTokens: number;
  budgetTokens: number;
} {
  const maxHistoryShare = params.maxHistoryShare ?? 0.5;
  const budgetTokens = Math.max(1, Math.floor(params.maxContextTokens * maxHistoryShare));
  let keptMessages = params.messages;
  const allDroppedMessages: AgentMessage[] = [];
  let droppedChunks = 0;
  let droppedMessages = 0;
  let droppedTokens = 0;

  const parts = normalizeParts(params.parts ?? DEFAULT_PARTS, keptMessages.length);

  while (keptMessages.length > 0 && estimateMessagesTokens(keptMessages) > budgetTokens) {
    const chunks = splitMessagesByTokenShare(keptMessages, parts);
    if (chunks.length <= 1) break;
    const [dropped, ...rest] = chunks;
    droppedChunks += 1;
    droppedMessages += dropped.length;
    droppedTokens += estimateMessagesTokens(dropped);
    allDroppedMessages.push(...dropped);
    keptMessages = rest.flat();
  }

  return {
    messages: keptMessages,
    droppedMessagesList: allDroppedMessages,
    droppedChunks,
    droppedMessages,
    droppedTokens,
    keptTokens: estimateMessagesTokens(keptMessages),
    budgetTokens,
  };
}

export function resolveContextWindowTokens(model?: ExtensionContext["model"]): number {
  return Math.max(1, Math.floor(model?.contextWindow ?? DEFAULT_CONTEXT_TOKENS));
}

// ---------------------------------------------------------------------------
// Tool output pruning — clears old tool result content from stale turns
// to free context space without requiring an LLM summarization call.
// ---------------------------------------------------------------------------

const PRUNE_PRESERVE_TURNS = 3; // Keep the most recent N user turns fully intact
const PRUNE_PRESERVE_TOKENS = 40_000; // Keep at least this many tokens of tool output
const PRUNE_MIN_SAVINGS = 20_000; // Only prune if we'd save at least this many tokens
const PRUNED_PLACEHOLDER = "[Tool output cleared to save context space]";

/**
 * Estimate the token cost of a single content block.
 */
function estimateBlockTokens(block: unknown): number {
  if (!block || typeof block !== "object") return 0;
  const rec = block as Record<string, unknown>;
  if (rec.type === "text" && typeof rec.text === "string") return Math.ceil(rec.text.length / 4);
  if (rec.type === "tool_result" && typeof rec.content === "string")
    return Math.ceil(rec.content.length / 4);
  // toolResult role messages store content at the top level
  if (typeof rec.content === "string") return Math.ceil(rec.content.length / 4);
  return 0;
}

/**
 * Check if a content block is a tool result that can be pruned.
 */
function isToolResultBlock(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  const rec = block as Record<string, unknown>;
  return rec.type === "tool_result" && typeof rec.content === "string";
}

/**
 * Prune old tool result outputs from conversation history to free context space.
 *
 * Walks backwards through messages, preserving the most recent `PRUNE_PRESERVE_TURNS`
 * user turns fully intact. For older messages, accumulates tool result token counts
 * and once we've seen `PRUNE_PRESERVE_TOKENS` worth of results, starts replacing
 * older tool outputs with a short placeholder.
 *
 * Returns a shallow-mutated copy of the messages array (original is not modified).
 */
export function pruneOldToolOutputs(messages: AgentMessage[]): {
  messages: AgentMessage[];
  prunedTokens: number;
  prunedCount: number;
} {
  if (messages.length === 0) return { messages, prunedTokens: 0, prunedCount: 0 };

  // Find the cutoff index: everything before the last N user turns is eligible for pruning
  let userTurnsSeen = 0;
  let cutoffIndex = messages.length; // Start assuming nothing is pruneable
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string };
    if (msg.role === "user") {
      userTurnsSeen++;
      if (userTurnsSeen >= PRUNE_PRESERVE_TURNS) {
        cutoffIndex = i;
        break;
      }
    }
  }

  if (cutoffIndex <= 0) return { messages, prunedTokens: 0, prunedCount: 0 };

  // First pass: walk backwards through pruneable messages, tally tool result tokens
  let totalToolTokens = 0;
  type PruneCandidate = { msgIdx: number; blockIdx: number; tokens: number };
  const candidates: PruneCandidate[] = [];

  for (let i = cutoffIndex - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; content?: unknown };

    // Handle role: "toolResult" messages (content is at top level)
    if (msg.role === "toolResult" && typeof msg.content === "string") {
      const tokens = Math.ceil(msg.content.length / 4);
      totalToolTokens += tokens;
      candidates.push({ msgIdx: i, blockIdx: -1, tokens });
      continue;
    }

    // Handle array content blocks with type: "tool_result"
    if (Array.isArray(msg.content)) {
      for (let j = msg.content.length - 1; j >= 0; j--) {
        if (isToolResultBlock(msg.content[j])) {
          const tokens = estimateBlockTokens(msg.content[j]);
          totalToolTokens += tokens;
          candidates.push({ msgIdx: i, blockIdx: j, tokens });
        }
      }
    }
  }

  // Decide how much to prune
  const potentialSavings = totalToolTokens - PRUNE_PRESERVE_TOKENS;
  if (potentialSavings < PRUNE_MIN_SAVINGS) {
    return { messages, prunedTokens: 0, prunedCount: 0 };
  }

  // Second pass: prune oldest tool results first (candidates are in reverse order,
  // so the oldest are at the end — we prune from the end of the candidates array)
  let prunedTokens = 0;
  let prunedCount = 0;
  const toPrune = new Set<string>(); // "msgIdx:blockIdx"

  // Candidates are ordered newest-first (we walked backwards). Prune from the oldest end.
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (prunedTokens >= potentialSavings) break;
    const c = candidates[i];
    // Keep at least PRUNE_PRESERVE_TOKENS of tool output
    const remainingAfterPrune = totalToolTokens - prunedTokens - c.tokens;
    if (remainingAfterPrune < PRUNE_PRESERVE_TOKENS) continue;
    toPrune.add(`${c.msgIdx}:${c.blockIdx}`);
    prunedTokens += c.tokens;
    prunedCount++;
  }

  if (prunedCount === 0) return { messages, prunedTokens: 0, prunedCount: 0 };

  // Apply pruning — create a shallow copy with modified messages
  const result = [...messages];
  for (const key of toPrune) {
    const [msgIdxStr, blockIdxStr] = key.split(":");
    const msgIdx = Number(msgIdxStr);
    const blockIdx = Number(blockIdxStr);

    if (blockIdx === -1) {
      // Prune a role: "toolResult" message — replace content
      result[msgIdx] = { ...result[msgIdx], content: PRUNED_PLACEHOLDER } as AgentMessage;
    } else {
      // Prune a tool_result block within an array content message
      const msg = result[msgIdx] as { content?: unknown[] };
      if (Array.isArray(msg.content)) {
        const newContent = [...msg.content];
        newContent[blockIdx] = {
          ...(newContent[blockIdx] as object),
          content: PRUNED_PLACEHOLDER,
        };
        result[msgIdx] = { ...result[msgIdx], content: newContent } as AgentMessage;
      }
    }
  }

  return { messages: result, prunedTokens, prunedCount };
}
