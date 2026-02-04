"""
MemU Sidecar — LLM Prompts.

All prompts used for memory extraction, preprocessing, retrieval, and
category management.  Adapted from the NevaMind-AI/MemU reference.
"""

from __future__ import annotations

# ===================================================================
# MEMORY TYPE EXTRACTION PROMPTS
# ===================================================================

PROFILE_EXTRACTION_PROMPT = """\
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
</items>
"""

EVENT_EXTRACTION_PROMPT = """\
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
</items>
"""

KNOWLEDGE_EXTRACTION_PROMPT = """\
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
</items>
"""

BEHAVIOR_EXTRACTION_PROMPT = """\
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
</items>
"""

SKILL_EXTRACTION_PROMPT = """\
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
</items>
"""

MEMORY_TYPE_PROMPTS: dict[str, str] = {
    "profile": PROFILE_EXTRACTION_PROMPT,
    "event": EVENT_EXTRACTION_PROMPT,
    "knowledge": KNOWLEDGE_EXTRACTION_PROMPT,
    "behavior": BEHAVIOR_EXTRACTION_PROMPT,
    "skill": SKILL_EXTRACTION_PROMPT,
}

# ===================================================================
# PREPROCESSING PROMPTS  (modality-specific)
# ===================================================================

CONVERSATION_SEGMENTATION_PROMPT = """\
You are analyzing a conversation to divide it into meaningful segments for memory extraction.

Rules:
- Divide based on topic changes, time gaps, or natural breaks.
- Each segment should contain at least {min_messages} messages.
- Maintain coherent themes within each segment.
- Use the [INDEX] numbers provided in the conversation.
- No overlapping segments.

Output a JSON array of segments:
[
  {{"start": 0, "end": 15, "topic": "Project planning discussion"}},
  {{"start": 16, "end": 30, "topic": "Technical architecture review"}}
]

Conversation:
{content}
"""

DOCUMENT_PREPROCESS_PROMPT = """\
You are a document processor. Produce two outputs from the document below:

1. A condensed version that preserves all key information while removing verbosity.
2. A single-sentence caption summarizing the document's purpose.

Do not introduce any new information or interpretations.

Output format:
<processed_content>
[Condensed document content here]
</processed_content>
<caption>
[One sentence caption here]
</caption>

Document:
{content}
"""

# ===================================================================
# CATEGORIZATION PROMPT
# ===================================================================

CATEGORIZE_ITEMS_PROMPT = """\
You are a memory categorization agent. Assign each memory item to one or more categories.

Available categories:
{categories}

Memory items to categorize:
{items}

For each item, output a JSON object with the item index and assigned category names:
[
  {{"index": 0, "categories": ["personal_info", "work_life"]}},
  {{"index": 1, "categories": ["preferences"]}}
]

Rules:
- Assign 1-3 categories per item.
- Only use the available category names listed above.
- Every item must have at least one category.
"""

# ===================================================================
# CATEGORY SUMMARY PROMPTS
# ===================================================================

CATEGORY_SUMMARY_PROMPT = """\
You are updating a memory category summary. Merge newly extracted user information \
into the existing summary.

Category: {category_name}
Description: {category_description}

Existing summary:
{existing_summary}

New memory items to incorporate:
{new_items}

Rules:
- Only add or update information — never delete existing info without cause.
- Summarize to approximately {target_length} characters.
- Use clear, structured Markdown with hierarchy.
- Exclude one-off events without long-term value.
- Preserve all meaningful existing content.

Output the updated summary (Markdown):
"""

# ===================================================================
# RETRIEVAL PROMPTS
# ===================================================================

PRE_RETRIEVAL_DECISION_PROMPT = """\
Decide if memory retrieval is needed to answer this query.

RETRIEVE when the query involves:
- Past events, preferences, or recall of user-specific information
- Historical data or previously discussed topics
- User preferences, habits, or personal context

NO_RETRIEVE when the query is:
- A greeting or small talk
- A question answerable from current context alone
- General knowledge not specific to the user
- A clarification of the current conversation

Query: {query}
Recent context: {context}

Output format:
<decision>RETRIEVE</decision>
<rewritten_query>[Self-contained version of the query]</rewritten_query>

Or:
<decision>NO_RETRIEVE</decision>
<rewritten_query>{query}</rewritten_query>
"""

QUERY_REWRITE_PROMPT = """\
Rewrite this query to be self-contained and explicit for memory search.

Rules:
- Resolve all pronouns (they, it, their, his, her).
- Resolve referential expressions (that, those, the same).
- Make implicit context explicit.
- Preserve the original intent.
- Only use information from the conversation history.

Conversation context:
{context}

Original query: {query}

Output format:
<rewritten_query>[Self-contained query here]</rewritten_query>
"""

SUFFICIENCY_JUDGMENT_PROMPT = """\
Judge whether the retrieved content is sufficient to answer the query.

Query: {query}

Retrieved content:
{content}

Evaluate:
1. Does the content directly address the question?
2. Is it specific and detailed enough?
3. Are there significant gaps or missing details?

Output format:
<consideration>[Your analysis here]</consideration>
<judgement>ENOUGH</judgement>

Or:
<consideration>[Your analysis here]</consideration>
<judgement>MORE</judgement>
"""

LLM_CATEGORY_RANKER_PROMPT = """\
Identify and rank the most relevant memory categories for this query.

Query: {query}

Available categories:
{categories}

Return up to {top_k} most relevant categories as a JSON array:
{{"analysis": "Brief reasoning", "category_ids": ["cat_id_1", "cat_id_2"]}}

Rules:
- Most relevant category first.
- Empty array if no categories are relevant.
- Do not invent category IDs.
"""

LLM_ITEM_RANKER_PROMPT = """\
Rank the most relevant memory items for this query.

Query: {query}

Memory items:
{items}

Return up to {top_k} most relevant items as a JSON array:
{{"analysis": "Brief reasoning", "item_ids": ["item_id_1", "item_id_2"]}}

Rules:
- Most relevant item first.
- Empty array if no items are relevant.
- Do not invent item IDs.
"""
