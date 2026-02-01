/**
 * Usage Reporter
 *
 * Buffers token usage events and reports them to the SaaS backend.
 * Only active in SaaS mode. Fire-and-forget with retry on failure.
 */

import { isSaasMode, type KeySource } from "./saas-credential-client.js";
import type { NormalizedUsage } from "./usage.js";

const FLUSH_INTERVAL_MS = 5_000; // 5 seconds
const MAX_BUFFER_SIZE = 10;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

interface UsageEvent {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  keySource: KeySource;
  clientPlatform?: string;
  estimatedCostUsd?: number;
}

interface FlushResponse {
  allowed: boolean;
  remaining: string;
  warning?: "80%" | "90%";
}

const buffer: UsageEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let onBudgetWarning: ((warning: string) => void) | null = null;
let onBudgetExhausted: (() => void) | null = null;

const saasApiUrl = process.env.THINKFLEET_SAAS_API_URL;
const agentDbId = process.env.THINKFLEET_AGENT_DB_ID;
const gatewayToken = process.env.THINKFLEET_GATEWAY_TOKEN;

/**
 * Report token usage from an LLM call.
 * Buffers events and flushes periodically or when buffer is full.
 */
export function reportUsage(params: {
  provider: string;
  model: string;
  usage: NormalizedUsage;
  keySource: KeySource;
  clientPlatform?: string;
  estimatedCostUsd?: number;
}): void {
  if (!isSaasMode()) return;

  buffer.push({
    provider: params.provider,
    model: params.model,
    inputTokens: params.usage.input ?? 0,
    outputTokens: params.usage.output ?? 0,
    cacheReadTokens: params.usage.cacheRead ?? 0,
    cacheWriteTokens: params.usage.cacheWrite ?? 0,
    keySource: params.keySource,
    clientPlatform: params.clientPlatform,
    estimatedCostUsd: params.estimatedCostUsd,
  });

  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
  }
}

/**
 * Set callbacks for budget warnings and exhaustion.
 */
export function setUsageCallbacks(callbacks: {
  onWarning?: (warning: string) => void;
  onExhausted?: () => void;
}): void {
  onBudgetWarning = callbacks.onWarning ?? null;
  onBudgetExhausted = callbacks.onExhausted ?? null;
}

/**
 * Flush all buffered events to the SaaS backend.
 */
async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (buffer.length === 0) return;

  const events = buffer.splice(0, buffer.length);

  for (const event of events) {
    await sendWithRetry(event);
  }
}

async function sendWithRetry(event: UsageEvent, attempt = 0): Promise<void> {
  try {
    const url = `${saasApiUrl}/api/internal/usage/report`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        agentDbId,
        ...event,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Usage report failed: ${response.status}`);
    }

    const data = (await response.json()) as FlushResponse;

    if (data.warning && onBudgetWarning) {
      onBudgetWarning(data.warning);
    }

    if (!data.allowed && onBudgetExhausted) {
      onBudgetExhausted();
    }
  } catch (error) {
    if (attempt < MAX_RETRY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      return sendWithRetry(event, attempt + 1);
    }
    console.error("[usage-reporter] Failed to report usage after retries:", error);
  }
}

/**
 * Force flush any remaining buffered events (call on shutdown).
 */
export async function flushUsageReporter(): Promise<void> {
  await flush();
}
