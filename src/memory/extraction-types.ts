/**
 * Type definitions for the hierarchical memory extraction system.
 *
 * Memory items are the "files" in the memory-as-filesystem model:
 * - Categories are "folders"
 * - Cross-references are "symlinks"
 * - Memory types classify the kind of information stored
 */

/** The five memory types extracted from conversations. */
export type MemoryType = "profile" | "event" | "knowledge" | "behavior" | "skill";

export const MEMORY_TYPES: readonly MemoryType[] = [
  "profile",
  "event",
  "knowledge",
  "behavior",
  "skill",
] as const;

/** A single memory item extracted by the LLM pipeline. */
export type ExtractedMemory = {
  memory_type: MemoryType;
  content: string;
  importance: number; // 1-10
  category: string;
  related_to?: string[]; // content snippets for cross-ref resolution
};

/** Result of running the extraction pipeline on a text segment. */
export type ExtractionResult = {
  items: ExtractedMemory[];
  session_key?: string;
};

/** A persisted memory item (stored in SQLite). */
export type MemoryItem = {
  id: string;
  memory_type: MemoryType;
  category: string;
  content: string;
  importance: number;
  source_session: string | null;
  created_at: string;
  updated_at: string;
};

/** A category with its summary and item count. */
export type CategorySummary = {
  name: string;
  summary: string;
  item_count: number;
  updated_at: string;
};

/** A cross-reference between two memory items. */
export type MemoryXref = {
  source_id: string;
  target_id: string;
  relation: string;
};

/** The 10 default categories for the memory-as-filesystem model. */
export const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string;
  description: string;
}> = [
  { name: "personal_info", description: "Demographics, identity, location, and personal details" },
  { name: "preferences", description: "Likes, dislikes, preferred tools, styles, and approaches" },
  { name: "work_life", description: "Job role, team, company, projects, and work-related context" },
  { name: "relationships", description: "People, contacts, teams, and social connections" },
  {
    name: "technical_skills",
    description: "Programming languages, frameworks, tools, and proficiencies",
  },
  {
    name: "communication_style",
    description: "Tone preferences, language patterns, and interaction style",
  },
  { name: "goals_plans", description: "Objectives, ongoing tasks, future plans, and intentions" },
  { name: "past_events", description: "Notable events, milestones, and historical context" },
  { name: "domain_knowledge", description: "Specialized knowledge, facts, and technical details" },
  {
    name: "habits_routines",
    description: "Behavioral patterns, workflows, and recurring approaches",
  },
] as const;

/** Memory search result that includes memory item metadata. */
export type MemoryItemSearchResult = {
  id: string;
  memory_type: MemoryType;
  category: string;
  content: string;
  importance: number;
  score: number;
};
