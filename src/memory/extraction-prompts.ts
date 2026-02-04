/**
 * LLM prompts for the memory extraction pipeline.
 *
 * Ported from tools/memu/prompts.py — adapted for TypeScript template strings.
 * Each prompt is a function that returns a formatted string with the necessary
 * context injected.
 */

import type { MemoryType } from "./extraction-types.js";

// ===================================================================
// MEMORY TYPE EXTRACTION PROMPTS
// ===================================================================

const PROFILE_EXTRACTION_PROMPT = `\
You are a memory extraction agent. Extract independent user profile items from the text below.

Rules:
- Each item must be a complete, standalone memory about the user.
- Single-line plain text only. No Markdown, no numbering, no bullets.
- Declarative and descriptive sentences only.
- Each item must be under 30 words.
- NO timestamps or time references.
- NO event-related items (those belong to the "event" type).
- Focus on meaningful, persistent information: characteristics, preferences, relationships, demographics.
- Skip one-time situations, temporary information, or ephemeral states.
- Only extract information directly stated or clearly implied by the user.

Output format — one item per line inside <items> tags:
<items>
User prefers dark mode in all applications.
User is a software engineer based in Austin, Texas.
</items>

If no profile items can be extracted, output:
<items>
</items>`;

const EVENT_EXTRACTION_PROMPT = `\
You are a memory extraction agent. Extract specific events and experiences from the text below.

Rules:
- Each item describes a concrete event that happened to or involved the user.
- Single-line plain text only. No Markdown.
- Include specific details when available: time, location, participants.
- Each item must be under 50 words.
- Clearly distinguish subject: "User did X" vs "User's friend did X".
- Only extract events directly stated or confirmed by the user.
- Skip behavioral patterns, habits, or factual knowledge (those are other types).

Output format — one item per line inside <items> tags:
<items>
User attended a React conference in San Francisco in March 2024.
User's team shipped the v2.0 release last Friday.
</items>

If no events can be extracted, output:
<items>
</items>`;

const KNOWLEDGE_EXTRACTION_PROMPT = `\
You are a memory extraction agent. Extract factual knowledge, concepts, and information from the text.

Rules:
- Each item is a factual statement that can be learned or referenced.
- Single-line plain text only. No Markdown.
- Declarative and descriptive sentences.
- Each item must be under 50 words.
- Focus on objective information: facts, definitions, technical details.
- Skip opinions, personal experiences, preferences, or behavioral patterns.
- Skip trivial or commonly known facts.
- Only extract knowledge directly stated or discussed in the text.

Output format — one item per line inside <items> tags:
<items>
PostgreSQL supports JSONB columns for semi-structured data storage.
The team uses a microservices architecture with gRPC for inter-service communication.
</items>

If no knowledge items can be extracted, output:
<items>
</items>`;

const BEHAVIOR_EXTRACTION_PROMPT = `\
You are a memory extraction agent. Extract behavioral patterns, routines, and habitual approaches.

Rules:
- Each item describes how the user typically acts, their routines, or regular approaches.
- Single-line or multi-line records (for multi-step patterns) are allowed.
- Each item must be under 50 words.
- Only record meaningful, recurring behaviors — skip one-time actions unless significant.
- Skip one-off events, sensitive topics, or assistant-only behaviors.
- Focus on: recurring patterns, typical approaches, established routines.

Output format — one item per line inside <items> tags:
<items>
User always reviews PRs before morning standup.
User prefers to debug by adding console.log statements before using a debugger.
</items>

If no behavior items can be extracted, output:
<items>
</items>`;

const SKILL_EXTRACTION_PROMPT = `\
You are a memory extraction agent. Extract skills, capabilities, and technical competencies.

Rules:
- Each item describes a skill or capability the user has demonstrated or mentioned.
- Single-line plain text only. No Markdown.
- Each item must be under 50 words.
- Focus on demonstrated abilities, not just topics discussed.
- Include the skill level if apparent (beginner, intermediate, expert).
- Skip general knowledge — only capture actionable skills.

Output format — one item per line inside <items> tags:
<items>
User is proficient in TypeScript and React for frontend development.
User has experience deploying containerized applications on AWS ECS.
</items>

If no skill items can be extracted, output:
<items>
</items>`;

/** Map of memory type to its extraction prompt. */
export const MEMORY_TYPE_PROMPTS: Record<MemoryType, string> = {
  profile: PROFILE_EXTRACTION_PROMPT,
  event: EVENT_EXTRACTION_PROMPT,
  knowledge: KNOWLEDGE_EXTRACTION_PROMPT,
  behavior: BEHAVIOR_EXTRACTION_PROMPT,
  skill: SKILL_EXTRACTION_PROMPT,
};

// ===================================================================
// CATEGORIZATION PROMPT
// ===================================================================

/**
 * Build a categorization prompt for assigning categories to extracted items.
 */
export function buildCategorizationPrompt(params: { categories: string; items: string }): string {
  return `\
You are a memory categorization agent. Assign each memory item to one or more categories.

Available categories:
${params.categories}

Memory items to categorize:
${params.items}

For each item, output a JSON object with the item index and assigned category names:
[
  {"index": 0, "categories": ["personal_info", "work_life"]},
  {"index": 1, "categories": ["preferences"]}
]

Rules:
- Assign 1-3 categories per item.
- Only use the available category names listed above.
- Every item must have at least one category.`;
}

// ===================================================================
// CATEGORY SUMMARY PROMPT
// ===================================================================

/**
 * Build a prompt to update a category summary with new items.
 */
export function buildCategorySummaryPrompt(params: {
  categoryName: string;
  categoryDescription: string;
  existingSummary: string;
  newItems: string;
  targetLength: number;
}): string {
  return `\
You are updating a memory category summary. Merge newly extracted user information \
into the existing summary.

Category: ${params.categoryName}
Description: ${params.categoryDescription}

Existing summary:
${params.existingSummary}

New memory items to incorporate:
${params.newItems}

Rules:
- Only add or update information — never delete existing info without cause.
- Summarize to approximately ${params.targetLength} characters.
- Use clear, structured Markdown with hierarchy.
- Exclude one-off events without long-term value.
- Preserve all meaningful existing content.

Output the updated summary (Markdown):`;
}

// ===================================================================
// DEDUPLICATION PROMPT
// ===================================================================

/**
 * Build a prompt to check if a new memory item duplicates existing items.
 */
export function buildDeduplicationPrompt(params: {
  newItem: string;
  existingItems: string;
}): string {
  return `\
You are a memory deduplication agent. Determine if the new memory item duplicates or updates an existing item.

New item:
${params.newItem}

Existing items in the same category:
${params.existingItems}

Classify the new item as one of:
- "new" — no similar existing item, should be added
- "duplicate" — identical or nearly identical to an existing item, should be skipped
- "update" — similar to an existing item but contains updated/additional info

Output a single JSON object:
{"action": "new"|"duplicate"|"update", "existing_id": "id_of_match_or_null", "reason": "brief explanation"}`;
}

// ===================================================================
// RETRIEVAL / PROACTIVE PROMPTS
// ===================================================================

/**
 * Build a prompt to rank categories by relevance to a query.
 */
export function buildCategoryRankerPrompt(params: {
  query: string;
  categories: string;
  topK: number;
}): string {
  return `\
Identify and rank the most relevant memory categories for this query.

Query: ${params.query}

Available categories:
${params.categories}

Return up to ${params.topK} most relevant categories as a JSON array:
{"analysis": "Brief reasoning", "category_ids": ["cat_id_1", "cat_id_2"]}

Rules:
- Most relevant category first.
- Empty array if no categories are relevant.
- Do not invent category IDs.`;
}

/**
 * Build a prompt to rank memory items by relevance to a query.
 */
export function buildItemRankerPrompt(params: {
  query: string;
  items: string;
  topK: number;
}): string {
  return `\
Rank the most relevant memory items for this query.

Query: ${params.query}

Memory items:
${params.items}

Return up to ${params.topK} most relevant items as a JSON array:
{"analysis": "Brief reasoning", "item_ids": ["item_id_1", "item_id_2"]}

Rules:
- Most relevant item first.
- Empty array if no items are relevant.
- Do not invent item IDs.`;
}

// ===================================================================
// HELPER: Parse <items> tag output from extraction prompts
// ===================================================================

/**
 * Parse the `<items>...</items>` output format from extraction prompts.
 * Returns an array of non-empty trimmed lines.
 */
export function parseItemsTag(response: string): string[] {
  const match = response.match(/<items>([\s\S]*?)<\/items>/);
  if (!match?.[1]) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
