/**
 * Exa-specific tools: exa_answer, exa_research, exa_contents
 *
 * These are separate from the web_search tool because they represent distinct
 * capabilities with different cost profiles and execution patterns.
 * Credit costs are DB-driven via the SearchCreditCost table — the bot sends
 * the searchType to the SaaS usage endpoint, which looks up actual credits.
 */

import { Type } from "@sinclair/typebox";

import type { ThinkfleetConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";
import {
  readResponseText,
  resolveTimeoutSeconds,
  withTimeout,
  DEFAULT_TIMEOUT_SECONDS,
} from "./web-shared.js";

const EXA_BASE_URL = "https://api.exa.ai";

// ─── Shared Exa key resolution ──────────────────────────────────────────────

function resolveExaApiKey(config?: ThinkfleetConfig): string | undefined {
  const exa = config?.tools?.web?.search?.exa;
  if (exa && typeof exa === "object" && "apiKey" in exa && typeof exa.apiKey === "string") {
    const trimmed = exa.apiKey.trim();
    if (trimmed) return trimmed;
  }
  const fromEnv = (process.env.EXA_API_KEY ?? "").trim();
  return fromEnv || undefined;
}

function resolveExaEnabled(config?: ThinkfleetConfig): boolean {
  // Exa tools are enabled when the Exa API key is available
  return !!resolveExaApiKey(config);
}

function missingExaKeyPayload() {
  return {
    error: "missing_exa_api_key",
    message:
      "This tool requires an Exa API key. Set EXA_API_KEY in the Gateway environment, or configure tools.web.search.exa.apiKey.",
    docs: "https://docs.thinkfleet.ai/tools/web",
  };
}

// ─── Exa Answer Tool ────────────────────────────────────────────────────────

type ExaAnswerResponse = {
  answer?: string;
  citations?: Array<{
    title?: string;
    url?: string;
    publishedDate?: string;
  }>;
};

const ExaAnswerSchema = Type.Object({
  query: Type.String({ description: "The question to answer using web sources." }),
  includeDomains: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Only include results from these domains (e.g., ['wikipedia.org', 'arxiv.org']).",
    }),
  ),
  excludeDomains: Type.Optional(
    Type.Array(Type.String(), {
      description: "Exclude results from these domains.",
    }),
  ),
});

export function createExaAnswerTool(options?: {
  config?: ThinkfleetConfig;
  sandboxed?: boolean;
}): AnyAgentTool | null {
  if (!resolveExaEnabled(options?.config)) return null;

  return {
    label: "Exa Answer",
    name: "exa_answer",
    description:
      "Get an AI-synthesized answer to a question using Exa's web search. Returns a natural language answer with cited sources. Best for factual questions that need web-sourced answers.",
    parameters: ExaAnswerSchema,
    execute: async (_toolCallId, args) => {
      const apiKey = resolveExaApiKey(options?.config);
      if (!apiKey) return jsonResult(missingExaKeyPayload());

      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "query", { required: true });
      const includeDomains = params.includeDomains as string[] | undefined;
      const excludeDomains = params.excludeDomains as string[] | undefined;

      const timeoutSeconds = resolveTimeoutSeconds(
        options?.config?.tools?.web?.search?.timeoutSeconds,
        DEFAULT_TIMEOUT_SECONDS,
      );

      const start = Date.now();
      const body: Record<string, unknown> = { query };
      if (includeDomains?.length) body.includeDomains = includeDomains;
      if (excludeDomains?.length) body.excludeDomains = excludeDomains;

      const res = await fetch(`${EXA_BASE_URL}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: withTimeout(undefined, timeoutSeconds * 1000),
      });

      if (!res.ok) {
        const detail = await readResponseText(res);
        throw new Error(`Exa Answer API error (${res.status}): ${detail || res.statusText}`);
      }

      const data = (await res.json()) as ExaAnswerResponse;

      return jsonResult({
        query,
        provider: "exa",
        tool: "exa_answer",
        tookMs: Date.now() - start,
        answer: data.answer ?? "No answer generated",
        citations: data.citations ?? [],
      });
    },
  };
}

// ─── Exa Contents Tool ──────────────────────────────────────────────────────

type ExaContentsResponse = {
  results?: Array<{
    url?: string;
    title?: string;
    text?: string;
    highlights?: string[];
    summary?: string;
  }>;
};

const ExaContentsSchema = Type.Object({
  urls: Type.Array(Type.String(), {
    description: "URLs to extract content from (max 10).",
    minItems: 1,
    maxItems: 10,
  }),
  maxChars: Type.Optional(
    Type.Number({
      description: "Maximum characters of text to extract per URL (default: 2000).",
      minimum: 100,
      maximum: 10000,
    }),
  ),
});

export function createExaContentsTool(options?: {
  config?: ThinkfleetConfig;
  sandboxed?: boolean;
}): AnyAgentTool | null {
  if (!resolveExaEnabled(options?.config)) return null;

  return {
    label: "Exa Contents",
    name: "exa_contents",
    description:
      "Extract full page content from URLs using Exa. Returns clean text, highlights, and summaries. Use this when you have URLs and need their content for analysis.",
    parameters: ExaContentsSchema,
    execute: async (_toolCallId, args) => {
      const apiKey = resolveExaApiKey(options?.config);
      if (!apiKey) return jsonResult(missingExaKeyPayload());

      const params = args as Record<string, unknown>;
      const urls = params.urls as string[];
      const maxChars = readNumberParam(params, "maxChars", { integer: true }) ?? 2000;

      const timeoutSeconds = resolveTimeoutSeconds(
        options?.config?.tools?.web?.search?.timeoutSeconds,
        DEFAULT_TIMEOUT_SECONDS,
      );

      const start = Date.now();

      const res = await fetch(`${EXA_BASE_URL}/contents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          urls,
          text: { maxCharacters: maxChars },
          highlights: true,
          summary: true,
        }),
        signal: withTimeout(undefined, timeoutSeconds * 1000),
      });

      if (!res.ok) {
        const detail = await readResponseText(res);
        throw new Error(`Exa Contents API error (${res.status}): ${detail || res.statusText}`);
      }

      const data = (await res.json()) as ExaContentsResponse;
      const results = Array.isArray(data.results) ? data.results : [];

      return jsonResult({
        provider: "exa",
        tool: "exa_contents",
        tookMs: Date.now() - start,
        count: results.length,
        results: results.map((r) => ({
          url: r.url ?? "",
          title: r.title ?? "",
          text: r.text ?? "",
          highlights: r.highlights ?? [],
          summary: r.summary ?? "",
        })),
      });
    },
  };
}

// ─── Exa Research Tool ──────────────────────────────────────────────────────

type ExaResearchStartResponse = {
  id?: string;
  status?: string;
};

type ExaResearchStatusResponse = {
  id?: string;
  status?: string; // "running", "completed", "failed"
  output?: string;
  results?: Array<{
    title?: string;
    url?: string;
    text?: string;
    publishedDate?: string;
  }>;
  error?: string;
};

const ExaResearchSchema = Type.Object({
  query: Type.String({
    description: "The research question or topic. Be specific for better results.",
  }),
  instructions: Type.Optional(
    Type.String({
      description:
        "Additional instructions for the research agent (e.g., 'Focus on peer-reviewed sources').",
    }),
  ),
});

export function createExaResearchTool(options?: {
  config?: ThinkfleetConfig;
  sandboxed?: boolean;
}): AnyAgentTool | null {
  if (!resolveExaEnabled(options?.config)) return null;

  return {
    label: "Exa Research",
    name: "exa_research",
    description:
      "Deep research using Exa's agentic research endpoint. Iteratively searches, processes, and re-searches for comprehensive results. Use for complex research questions that need thorough analysis. This is slower and more expensive than regular search.",
    parameters: ExaResearchSchema,
    execute: async (_toolCallId, args) => {
      const apiKey = resolveExaApiKey(options?.config);
      if (!apiKey) return jsonResult(missingExaKeyPayload());

      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "query", { required: true });
      const instructions = readStringParam(params, "instructions");

      const start = Date.now();

      // 1. Start the research task
      const body: Record<string, unknown> = { query };
      if (instructions) body.instructions = instructions;

      const startRes = await fetch(`${EXA_BASE_URL}/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: withTimeout(undefined, 30_000), // 30s to start the task
      });

      if (!startRes.ok) {
        const detail = await readResponseText(startRes);
        throw new Error(
          `Exa Research API error (${startRes.status}): ${detail || startRes.statusText}`,
        );
      }

      const startData = (await startRes.json()) as ExaResearchStartResponse;
      const taskId = startData.id;

      if (!taskId) {
        throw new Error("Exa Research API did not return a task ID");
      }

      // 2. Poll for completion with exponential backoff
      const maxWaitMs = 120_000; // 2 minutes max
      let delay = 2_000; // start at 2s
      const maxDelay = 10_000;

      while (Date.now() - start < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, delay));

        const statusRes = await fetch(`${EXA_BASE_URL}/research/${taskId}`, {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
          },
          signal: withTimeout(undefined, 15_000),
        });

        if (!statusRes.ok) {
          const detail = await readResponseText(statusRes);
          throw new Error(
            `Exa Research status check error (${statusRes.status}): ${detail || statusRes.statusText}`,
          );
        }

        const statusData = (await statusRes.json()) as ExaResearchStatusResponse;

        if (statusData.status === "completed") {
          return jsonResult({
            query,
            provider: "exa",
            tool: "exa_research",
            taskId,
            tookMs: Date.now() - start,
            output: statusData.output ?? "",
            results: statusData.results ?? [],
          });
        }

        if (statusData.status === "failed") {
          throw new Error(`Exa Research task failed: ${statusData.error ?? "Unknown error"}`);
        }

        // Still running — increase delay with exponential backoff
        delay = Math.min(delay * 1.5, maxDelay);
      }

      // Timeout — return partial result
      return jsonResult({
        query,
        provider: "exa",
        tool: "exa_research",
        taskId,
        tookMs: Date.now() - start,
        error: "timeout",
        message: `Research task ${taskId} is still running after ${Math.round((Date.now() - start) / 1000)}s. The task may complete later.`,
      });
    },
  };
}
