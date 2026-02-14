/**
 * Visual memory extraction: takes image descriptions (already produced by the
 * vision LLM) and extracts structured visual entities for long-term memory.
 *
 * This does NOT re-run the vision model. It takes the text description output
 * from applyMediaUnderstanding() and runs a lightweight text LLM call to
 * extract structured entities.
 */

import type { ThinkfleetConfig } from "../../config/config.js";
import type { MediaUnderstandingOutput } from "../../media-understanding/types.js";
import { callExtractionLLM, parseJsonResponse } from "../extraction-llm.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { VISUAL_MEMORY_EXTRACTION_PROMPT } from "./extraction-prompt.js";
import { storeVisualMemory } from "./saas-client.js";
import type { VisualEntity, VisualEntityType } from "./types.js";
import { VISUAL_ENTITY_TYPES } from "./types.js";

const log = createSubsystemLogger("visual-memory");

/**
 * Extract visual entities from image descriptions and store them in SaaS.
 * This is called fire-and-forget — it never blocks the chat response.
 */
export async function extractAndStoreVisualMemories(params: {
  outputs: MediaUnderstandingOutput[];
  senderId?: string;
  senderName?: string;
  messageText?: string;
  cfg?: ThinkfleetConfig;
  agentDir?: string;
}): Promise<void> {
  const { outputs, senderId, messageText, cfg, agentDir } = params;

  if (!senderId) {
    log.debug("skipping visual extraction: no senderId");
    return;
  }

  const imageDescriptions = outputs
    .filter((o) => o.kind === "image.description")
    .map((o) => o.text)
    .filter(Boolean);

  if (imageDescriptions.length === 0) {
    return;
  }

  // Build the extraction input: combine image descriptions with user text
  const parts: string[] = [];
  if (messageText?.trim()) {
    parts.push(`User's message: "${messageText.trim()}"`);
  }
  for (let i = 0; i < imageDescriptions.length; i++) {
    parts.push(`Image ${i + 1} description: ${imageDescriptions[i]}`);
  }
  const extractionInput = parts.join("\n\n");

  // Run lightweight text LLM call for entity extraction
  let entities: VisualEntity[];
  try {
    const response = await callExtractionLLM({
      systemPrompt: VISUAL_MEMORY_EXTRACTION_PROMPT,
      userContent: extractionInput,
      cfg,
      agentDir,
      llmConfig: { temperature: 0.1 },
    });

    const parsed = parseJsonResponse<VisualEntity[]>(response);
    if (!parsed || !Array.isArray(parsed)) {
      log.debug("visual extraction: no entities parsed from response");
      return;
    }
    entities = parsed;
  } catch (err) {
    log.debug(`visual extraction LLM call failed: ${String(err)}`);
    return;
  }

  if (entities.length === 0) {
    log.debug("visual extraction: no entities found");
    return;
  }

  // Validate and store each entity
  let stored = 0;
  for (const entity of entities) {
    if (!isValidEntityType(entity.entityType) || !entity.description) {
      continue;
    }

    try {
      await storeVisualMemory({
        entityType: entity.entityType,
        entityName: entity.entityName,
        description: entity.description,
        context: messageText?.trim()
          ? `Shared via image on ${new Date().toISOString().split("T")[0]}: "${messageText.trim().slice(0, 200)}"`
          : `Shared via image on ${new Date().toISOString().split("T")[0]}`,
        importance: Math.min(10, Math.max(1, entity.importance ?? 7)),
        senderId,
        senderName: params.senderName,
        metadata: entity.attributes as Record<string, unknown> | undefined,
      });
      stored++;
    } catch (err) {
      log.debug(`visual memory store failed: ${String(err)}`);
    }
  }

  if (stored > 0) {
    log.debug(`visual memory: stored ${stored} entities for sender ${senderId}`);
  }
}

function isValidEntityType(type: string): type is VisualEntityType {
  return VISUAL_ENTITY_TYPES.includes(type as VisualEntityType);
}
