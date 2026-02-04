/**
 * LLM client for the memory extraction pipeline.
 *
 * Uses the bot's existing credential resolution chain (SaaS → Auth Profiles →
 * Env vars → models.json) via resolveApiKeyForProvider and the pi-ai library
 * for completions.
 */

import { completeSimple, type TextContent } from "@mariozechner/pi-ai";

import type { ThinkfleetConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { getApiKeyForModel, requireApiKey } from "../agents/model-auth.js";
import { resolveModel } from "../agents/pi-embedded-runner/model.js";

const log = createSubsystemLogger("memory-extraction");

const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.1;
const EXTRACTION_TIMEOUT_MS = 30_000;

export type ExtractionLLMConfig = {
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Call an LLM for memory extraction tasks (extraction, categorization,
 * deduplication, summarization).
 *
 * Uses the bot's existing SaaS credential chain for authentication.
 */
export async function callExtractionLLM(params: {
  systemPrompt: string;
  userContent: string;
  cfg?: ThinkfleetConfig;
  agentDir?: string;
  llmConfig?: ExtractionLLMConfig;
}): Promise<string> {
  const provider = params.llmConfig?.provider ?? DEFAULT_PROVIDER;
  const modelId = params.llmConfig?.model ?? DEFAULT_MODEL;
  const maxTokens = params.llmConfig?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = params.llmConfig?.temperature ?? DEFAULT_TEMPERATURE;

  const resolved = resolveModel(provider, modelId, params.agentDir, params.cfg);
  if (!resolved.model) {
    throw new Error(resolved.error ?? `Unknown extraction model: ${provider}/${modelId}`);
  }

  const apiKey = requireApiKey(
    await getApiKeyForModel({ model: resolved.model, cfg: params.cfg }),
    provider,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

  try {
    const res = await completeSimple(
      resolved.model,
      {
        messages: [
          {
            role: "user",
            content: `${params.systemPrompt}\n\n${params.userContent}`,
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey,
        maxTokens,
        temperature,
        signal: controller.signal,
      },
    );

    const text = res.content
      .filter((block): block is TextContent => block.type === "text")
      .map((block) => block.text)
      .join("");

    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`extraction LLM call failed: ${message}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse a JSON response from the LLM, handling common issues like
 * markdown code fences and trailing commas.
 */
export function parseJsonResponse<T>(raw: string): T | null {
  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  // Strip leading/trailing text outside JSON
  const jsonStart = cleaned.indexOf("[") !== -1 ? cleaned.indexOf("[") : cleaned.indexOf("{");
  const jsonEndBracket = cleaned.lastIndexOf("]");
  const jsonEndBrace = cleaned.lastIndexOf("}");
  const jsonEnd = Math.max(jsonEndBracket, jsonEndBrace);

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    log.debug(`failed to parse JSON response: ${cleaned.slice(0, 200)}`);
    return null;
  }
}
