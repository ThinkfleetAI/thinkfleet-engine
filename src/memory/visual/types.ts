/**
 * Types for the visual memory extraction system.
 */

export type VisualEntityType = "person" | "pet" | "object" | "place" | "scene";

export const VISUAL_ENTITY_TYPES: readonly VisualEntityType[] = [
  "person",
  "pet",
  "object",
  "place",
  "scene",
] as const;

/** A single entity extracted from an image description by the LLM. */
export type VisualEntity = {
  entityType: VisualEntityType;
  entityName?: string;
  description: string;
  attributes?: Record<string, string>;
  importance: number;
};

/** Result of running visual extraction on image descriptions. */
export type VisualExtractionResult = {
  entities: VisualEntity[];
};

/** Parameters for storing a visual memory via the SaaS bridge. */
export type StoreVisualMemoryParams = {
  entityType: VisualEntityType;
  entityName?: string;
  description: string;
  context?: string;
  importance: number;
  senderId: string;
  senderName?: string;
  metadata?: Record<string, unknown>;
};

/** A visual memory item returned from SaaS search/list. */
export type VisualMemoryResult = {
  id: string;
  entityType: string;
  entityName: string | null;
  description: string;
  context: string | null;
  importance: number;
  senderId: string;
  senderName: string | null;
  metadata: unknown;
  score: number;
  createdAt: string;
};
