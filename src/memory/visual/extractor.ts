/**
 * Visual memory extraction: extracts structured visual entities for long-term
 * memory from either:
 *   1. Text descriptions (from applyMediaUnderstanding — channel images)
 *   2. Raw base64 images (from web chat — single combined vision+extraction call)
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
 * Extract visual entities from image descriptions (text) and store them.
 * Used when applyMediaUnderstanding has already produced text descriptions
 * (e.g. channel images from Telegram, WhatsApp, etc.).
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
    log.info("skipping visual extraction: no senderId");
    return;
  }

  const imageDescriptions = outputs
    .filter((o) => o.kind === "image.description")
    .map((o) => o.text)
    .filter(Boolean);

  if (imageDescriptions.length === 0) {
    log.info("skipping visual extraction: no image descriptions found");
    return;
  }

  log.info(
    `visual extraction (text): ${imageDescriptions.length} description(s), senderId=${senderId}`,
  );

  const parts: string[] = [];
  if (messageText?.trim()) {
    parts.push(`User's message: "${messageText.trim()}"`);
  }
  for (let i = 0; i < imageDescriptions.length; i++) {
    parts.push(`Image ${i + 1} description: ${imageDescriptions[i]}`);
  }

  await runExtractionAndStore({
    extractionInput: parts.join("\n\n"),
    senderId,
    senderName: params.senderName,
    messageText,
    cfg,
    agentDir,
  });
}

/**
 * Extract visual entities directly from raw base64 images and store them.
 * Uses a single vision-capable LLM call to both describe the image and
 * extract entities — no separate media understanding step needed.
 *
 * Used for web chat images that bypass applyMediaUnderstanding.
 */
export async function extractAndStoreFromRawImages(params: {
  images: Array<{ data: string; mimeType: string }>;
  senderId?: string;
  senderName?: string;
  messageText?: string;
  cfg?: ThinkfleetConfig;
  agentDir?: string;
}): Promise<void> {
  const { images, senderId, messageText, cfg, agentDir } = params;

  if (!senderId) {
    log.info("skipping visual extraction (raw): no senderId");
    return;
  }

  if (images.length === 0) {
    return;
  }

  log.info(
    `visual extraction (raw): ${images.length} image(s), senderId=${senderId}, messageText="${messageText?.slice(0, 60) ?? ""}"`,
  );

  const parts: string[] = [];
  if (messageText?.trim()) {
    parts.push(`User's message: "${messageText.trim()}"`);
  }
  parts.push(
    `${images.length} image(s) are attached. Analyze them visually and extract any identifiable entities.`,
  );

  await runExtractionAndStore({
    extractionInput: parts.join("\n\n"),
    images,
    senderId,
    senderName: params.senderName,
    messageText,
    cfg,
    agentDir,
  });
}

/**
 * Shared extraction + store logic used by both text-description and raw-image paths.
 */
async function runExtractionAndStore(params: {
  extractionInput: string;
  images?: Array<{ data: string; mimeType: string }>;
  senderId: string;
  senderName?: string;
  messageText?: string;
  cfg?: ThinkfleetConfig;
  agentDir?: string;
}): Promise<void> {
  const { extractionInput, images, senderId, messageText, cfg, agentDir } = params;

  let entities: VisualEntity[];
  try {
    const response = await callExtractionLLM({
      systemPrompt: VISUAL_MEMORY_EXTRACTION_PROMPT,
      userContent: extractionInput,
      images,
      cfg,
      agentDir,
      llmConfig: { temperature: 0.1 },
    });

    const parsed = parseJsonResponse<VisualEntity[]>(response);
    if (!parsed || !Array.isArray(parsed)) {
      log.info("visual extraction: no entities parsed from LLM response");
      return;
    }
    entities = parsed;
  } catch (err) {
    log.info(`visual extraction LLM call failed: ${String(err)}`);
    return;
  }

  if (entities.length === 0) {
    log.info("visual extraction: no entities found in LLM output");
    return;
  }

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
      log.info(`visual memory store failed: ${String(err)}`);
    }
  }

  if (stored > 0) {
    log.info(`visual memory: stored ${stored} entities for sender ${senderId}`);
  }
}

function isValidEntityType(type: string): type is VisualEntityType {
  return VISUAL_ENTITY_TYPES.includes(type as VisualEntityType);
}
