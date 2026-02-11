/**
 * Observer Agent — Compresses raw conversation messages into dense observations.
 *
 * Triggered when unobserved messages exceed the configured token threshold.
 * Uses the shared extraction LLM infrastructure for the background call.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { estimateTokens } from "@mariozechner/pi-coding-agent";

import type { ThinkfleetConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { callExtractionLLM } from "../extraction-llm.js";
import { OBSERVER_SYSTEM_PROMPT, parseObservations } from "./prompts.js";
import type { ObservationStore } from "./store.js";
import type { Observation, ResolvedObservationalConfig } from "./types.js";

const log = createSubsystemLogger("observational-observer");

const MAX_TOOL_RESULT_CHARS = 2_000;

/**
 * Run the Observer: compress unobserved messages into observation entries.
 *
 * @returns New observations created (empty array if threshold not reached).
 */
export async function runObserver(params: {
  messages: AgentMessage[];
  sessionKey: string;
  store: ObservationStore;
  config: ResolvedObservationalConfig;
  cfg?: ThinkfleetConfig;
}): Promise<Observation[]> {
  const { messages, sessionKey, store, config } = params;

  // High water mark: how far we've already observed
  const hwm = store.getHighWaterMark(sessionKey);
  if (hwm >= messages.length) return [];

  // Slice unobserved messages
  const unobserved = messages.slice(hwm);

  // Estimate tokens
  const unobservedTokens = unobserved.reduce((sum, m) => sum + estimateTokens(m), 0);
  if (unobservedTokens < config.observerThresholdTokens) return [];

  log.debug(
    `observer triggered: ${unobserved.length} messages, ~${unobservedTokens} tokens (threshold: ${config.observerThresholdTokens})`,
  );

  // Serialize messages to text for the LLM
  const messageText = serializeMessagesForObserver(unobserved);
  if (!messageText) return [];

  const response = await callExtractionLLM({
    systemPrompt: OBSERVER_SYSTEM_PROMPT,
    userContent: messageText,
    cfg: params.cfg,
    llmConfig: {
      provider: config.provider,
      model: config.model,
      maxTokens: 4096,
      temperature: 0.1,
    },
  });

  const parsed = parseObservations(response, {
    sessionKey,
    messageStartIndex: hwm,
    messageEndIndex: hwm + unobserved.length,
    generation: 0,
  });

  if (parsed.length === 0) {
    log.debug("observer produced no observations");
    return [];
  }

  // Persist
  const observations: Observation[] = [];
  for (const obs of parsed) {
    observations.push(store.insert(obs));
  }

  log.debug(`observer created ${observations.length} observations`);
  return observations;
}

/**
 * Serialize AgentMessage[] to human-readable text for the Observer LLM.
 * Truncates large tool results to avoid blowing up the compression prompt.
 */
function serializeMessagesForObserver(messages: AgentMessage[]): string | null {
  const parts: string[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      const text = extractText(msg.content);
      if (text) parts.push(`User: ${text}`);
    } else if (msg.role === "assistant") {
      const textParts: string[] = [];
      for (const block of msg.content) {
        if (block.type === "text") textParts.push(block.text);
        if (block.type === "toolCall") {
          textParts.push(`[Tool call: ${block.name}]`);
        }
      }
      const text = textParts.join("\n").trim();
      if (text) parts.push(`Assistant: ${text}`);
    } else if (msg.role === "toolResult") {
      const text = extractText(msg.content);
      if (text) {
        const truncated =
          text.length > MAX_TOOL_RESULT_CHARS
            ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}... [truncated, ${text.length} chars total]`
            : text;
        parts.push(`Tool (${msg.toolName}): ${truncated}`);
      }
    }
  }

  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

function extractText(content: string | ReadonlyArray<{ type: string; text?: string }>): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (block): block is { type: "text"; text: string } => block.type === "text" && !!block.text,
    )
    .map((block) => block.text)
    .join("\n")
    .trim();
}
