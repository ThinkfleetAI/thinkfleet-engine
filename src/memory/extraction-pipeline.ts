/**
 * Memory Extraction Pipeline — 5-Stage processor.
 *
 * Extracts structured memories from conversation text using LLM calls,
 * then persists them into the native SQLite memory system.
 *
 * Pipeline stages:
 *   1. Preprocess  — Clean text, skip short/command messages
 *   2. Extract     — LLM extraction for each memory type (parallel)
 *   3. Categorize  — Assign categories, deduplicate against existing items
 *   4. Persist     — Embed & store in memory_items + vector/FTS tables
 *   5. Summarize   — Update category summaries for modified categories
 */

import type { ThinkfleetConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { MemoryIndexManager } from "./manager.js";
import {
  DEFAULT_CATEGORIES,
  MEMORY_TYPES,
  type ExtractedMemory,
  type ExtractionResult,
  type MemoryType,
} from "./extraction-types.js";
import {
  MEMORY_TYPE_PROMPTS,
  buildCategorizationPrompt,
  buildCategorySummaryPrompt,
  parseItemsTag,
} from "./extraction-prompts.js";
import {
  callExtractionLLM,
  parseJsonResponse,
  type ExtractionLLMConfig,
} from "./extraction-llm.js";

const log = createSubsystemLogger("memory-extraction");

const MIN_TEXT_LENGTH = 50;
const MAX_TEXT_LENGTH = 15_000;
const DEFAULT_MAX_ITEMS = 20;
const DEFAULT_SUMMARY_LENGTH = 500;

export type ExtractionPipelineConfig = {
  llm: ExtractionLLMConfig;
  maxItemsPerExtraction: number;
  cfg?: ThinkfleetConfig;
  agentDir?: string;
};

// ===================================================================
// Stage 1: Preprocess
// ===================================================================

function preprocessText(text: string): string | null {
  const trimmed = text.trim();

  // Skip very short text — not enough signal
  if (trimmed.length < MIN_TEXT_LENGTH) return null;

  // Skip obvious commands
  if (trimmed.startsWith("/") || trimmed.startsWith("!")) return null;

  // Truncate very long text to avoid expensive LLM calls
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return trimmed.slice(0, MAX_TEXT_LENGTH);
  }

  return trimmed;
}

// ===================================================================
// Stage 2: Extract
// ===================================================================

async function extractMemories(
  text: string,
  config: ExtractionPipelineConfig,
): Promise<Array<{ memory_type: MemoryType; content: string }>> {
  const results: Array<{ memory_type: MemoryType; content: string }> = [];

  // Run all 5 memory type extractions in parallel
  const extractions = await Promise.allSettled(
    MEMORY_TYPES.map(async (memType) => {
      const prompt = MEMORY_TYPE_PROMPTS[memType];
      const response = await callExtractionLLM({
        systemPrompt: prompt,
        userContent: text,
        cfg: config.cfg,
        agentDir: config.agentDir,
        llmConfig: config.llm,
      });
      const items = parseItemsTag(response);
      return items.map((content) => ({ memory_type: memType, content }));
    }),
  );

  for (const result of extractions) {
    if (result.status === "fulfilled") {
      results.push(...result.value);
    } else {
      log.debug(`extraction failed for a memory type: ${String(result.reason)}`);
    }
  }

  // Limit total items
  return results.slice(0, config.maxItemsPerExtraction);
}

// ===================================================================
// Stage 3: Categorize
// ===================================================================

type CategorizationResult = { index: number; categories: string[] };

async function categorizeItems(
  items: Array<{ memory_type: MemoryType; content: string }>,
  config: ExtractionPipelineConfig,
): Promise<ExtractedMemory[]> {
  if (items.length === 0) return [];

  const categoriesText = DEFAULT_CATEGORIES.map((cat) => `- ${cat.name}: ${cat.description}`).join(
    "\n",
  );

  const itemsText = items
    .map((item, idx) => `[${idx}] [${item.memory_type}] ${item.content}`)
    .join("\n");

  const prompt = buildCategorizationPrompt({
    categories: categoriesText,
    items: itemsText,
  });

  let categorizations: CategorizationResult[] | null = null;
  try {
    const response = await callExtractionLLM({
      systemPrompt: "You are a memory categorization agent.",
      userContent: prompt,
      cfg: config.cfg,
      agentDir: config.agentDir,
      llmConfig: config.llm,
    });
    categorizations = parseJsonResponse<CategorizationResult[]>(response);
  } catch (err) {
    log.debug(`categorization LLM call failed: ${String(err)}`);
  }

  // Build ExtractedMemory items with categories
  const validCategories = new Set(DEFAULT_CATEGORIES.map((c) => c.name));
  return items.map((item, idx) => {
    const catResult = categorizations?.find((c) => c.index === idx);
    let category = "domain_knowledge"; // fallback
    if (catResult?.categories?.[0] && validCategories.has(catResult.categories[0])) {
      category = catResult.categories[0];
    } else {
      // Heuristic fallback based on memory type
      category = defaultCategoryForType(item.memory_type);
    }

    return {
      memory_type: item.memory_type,
      content: item.content,
      importance: estimateImportance(item.memory_type, item.content),
      category,
    };
  });
}

function defaultCategoryForType(memType: MemoryType): string {
  switch (memType) {
    case "profile":
      return "personal_info";
    case "event":
      return "past_events";
    case "knowledge":
      return "domain_knowledge";
    case "behavior":
      return "habits_routines";
    case "skill":
      return "technical_skills";
  }
}

function estimateImportance(memType: MemoryType, content: string): number {
  // Base importance by type
  let importance = 5;
  if (memType === "profile") importance = 7;
  if (memType === "skill") importance = 6;
  if (memType === "behavior") importance = 6;

  // Boost for longer, more detailed items
  if (content.length > 80) importance = Math.min(10, importance + 1);

  return importance;
}

// ===================================================================
// Stage 4: Persist
// ===================================================================

async function persistItems(
  items: ExtractedMemory[],
  manager: MemoryIndexManager,
  sessionKey?: string,
): Promise<{ inserted: number; categories: Set<string> }> {
  let inserted = 0;
  const modifiedCategories = new Set<string>();

  // Ensure vector table exists for memory items
  await manager.ensureMemoryVectorTable();

  for (const item of items) {
    try {
      // Check for duplicates
      const similar = await manager.findSimilarItems({
        content: item.content,
        category: item.category,
        limit: 3,
      });

      const isDuplicate = similar.some((s) => s.score > 0.9);
      if (isDuplicate) {
        log.debug(`skipping duplicate memory item: ${item.content.slice(0, 60)}`);
        continue;
      }

      await manager.insertMemoryItem({ item, sessionKey });
      inserted += 1;
      modifiedCategories.add(item.category);
    } catch (err) {
      log.debug(`failed to persist memory item: ${String(err)}`);
    }
  }

  return { inserted, categories: modifiedCategories };
}

// ===================================================================
// Stage 5: Summarize
// ===================================================================

async function updateSummaries(
  categories: Set<string>,
  manager: MemoryIndexManager,
  config: ExtractionPipelineConfig,
): Promise<void> {
  for (const categoryName of categories) {
    try {
      const existing = manager.getCategorySummary(categoryName);
      const items = manager.getItemsByCategory(categoryName, 20);
      if (items.length === 0) continue;

      const categoryDef = DEFAULT_CATEGORIES.find((c) => c.name === categoryName);
      const newItemsText = items
        .slice(0, 10)
        .map((item) => `- [${item.memory_type}] ${item.content}`)
        .join("\n");

      const prompt = buildCategorySummaryPrompt({
        categoryName,
        categoryDescription: categoryDef?.description ?? categoryName,
        existingSummary: existing?.summary || "(No existing summary)",
        newItems: newItemsText,
        targetLength: DEFAULT_SUMMARY_LENGTH,
      });

      const response = await callExtractionLLM({
        systemPrompt: "You are a memory category summary agent.",
        userContent: prompt,
        cfg: config.cfg,
        agentDir: config.agentDir,
        llmConfig: { ...config.llm, temperature: 0.2 },
      });

      const summary = response.trim();
      if (summary.length > 0) {
        manager.updateCategorySummary(categoryName, summary);
      }
    } catch (err) {
      log.debug(`failed to update summary for ${categoryName}: ${String(err)}`);
    }
  }
}

// ===================================================================
// Pipeline Orchestrator
// ===================================================================

/**
 * Run the full 5-stage extraction pipeline on conversation text.
 */
export async function runExtractionPipeline(params: {
  text: string;
  manager: MemoryIndexManager;
  config: ExtractionPipelineConfig;
  sessionKey?: string;
}): Promise<ExtractionResult> {
  const { text, manager, config, sessionKey } = params;

  // Stage 1: Preprocess
  const cleaned = preprocessText(text);
  if (!cleaned) {
    return { items: [], session_key: sessionKey };
  }

  log.debug(`extraction pipeline: processing ${cleaned.length} chars`);

  // Stage 2: Extract
  const rawItems = await extractMemories(cleaned, config);
  if (rawItems.length === 0) {
    log.debug("extraction pipeline: no items extracted");
    return { items: [], session_key: sessionKey };
  }

  log.debug(`extraction pipeline: extracted ${rawItems.length} raw items`);

  // Stage 3: Categorize
  const categorized = await categorizeItems(rawItems, config);

  // Stage 4: Persist
  const { inserted, categories } = await persistItems(categorized, manager, sessionKey);
  log.debug(
    `extraction pipeline: persisted ${inserted} items across ${categories.size} categories`,
  );

  // Stage 5: Summarize (only for categories that changed)
  if (categories.size > 0) {
    await updateSummaries(categories, manager, config);
  }

  return { items: categorized, session_key: sessionKey };
}
