/**
 * Memory Extraction Worker — Background processor.
 *
 * Listens to session transcript updates and runs the extraction pipeline
 * on new conversation segments. Non-blocking — errors are logged but
 * never affect agent execution.
 */

import fs from "node:fs/promises";

import type { ThinkfleetConfig } from "../config/config.js";
import type { MemorySearchConfig } from "../config/types.tools.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { onSessionTranscriptUpdate } from "../sessions/transcript-events.js";
import type { MemoryIndexManager } from "./manager.js";
import { runExtractionPipeline, type ExtractionPipelineConfig } from "./extraction-pipeline.js";

const log = createSubsystemLogger("memory-extraction-worker");

const DEFAULT_DEBOUNCE_MS = 5_000;
const DEFAULT_MAX_ITEMS = 20;
const MIN_DELTA_BYTES = 500; // Minimum new bytes before triggering extraction

export type ExtractionWorkerHandle = {
  stop: () => void;
};

/**
 * Start the extraction worker that listens for session transcript updates
 * and runs the extraction pipeline on new content.
 */
export function startExtractionWorker(params: {
  manager: MemoryIndexManager;
  cfg: ThinkfleetConfig;
  extractionConfig?: MemorySearchConfig["extraction"];
}): ExtractionWorkerHandle {
  const { manager, cfg } = params;
  const extraction = params.extractionConfig;
  const debounceMs = extraction?.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  const pipelineConfig: ExtractionPipelineConfig = {
    llm: {
      provider: extraction?.provider,
      model: extraction?.model,
    },
    maxItemsPerExtraction: extraction?.maxItemsPerExtraction ?? DEFAULT_MAX_ITEMS,
    cfg,
  };

  // Track byte offsets per session file to only process new content
  const fileOffsets = new Map<string, number>();
  let debounceTimer: NodeJS.Timeout | null = null;
  let pendingFiles = new Set<string>();
  let running = false;
  let stopped = false;

  const processFiles = async () => {
    if (stopped || running || pendingFiles.size === 0) return;
    running = true;
    const files = Array.from(pendingFiles);
    pendingFiles = new Set();

    for (const sessionFile of files) {
      if (stopped) break;
      try {
        await processSessionFile(sessionFile, fileOffsets, manager, pipelineConfig);
      } catch (err) {
        log.debug(`extraction worker error for ${sessionFile}: ${String(err)}`);
      }
    }
    running = false;

    // If more files arrived while we were processing, schedule again
    if (pendingFiles.size > 0 && !stopped) {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void processFiles();
      }, debounceMs);
    }
  };

  const unsubscribe = onSessionTranscriptUpdate((update) => {
    if (stopped) return;
    pendingFiles.add(update.sessionFile);

    if (debounceTimer) return; // Already debouncing
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void processFiles();
    }, debounceMs);
  });

  log.debug("extraction worker started");

  return {
    stop: () => {
      stopped = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      unsubscribe();
      log.debug("extraction worker stopped");
    },
  };
}

/**
 * Read new content from a session transcript file and run extraction.
 */
async function processSessionFile(
  sessionFile: string,
  offsets: Map<string, number>,
  manager: MemoryIndexManager,
  config: ExtractionPipelineConfig,
): Promise<void> {
  let content: string;
  try {
    content = await fs.readFile(sessionFile, "utf-8");
  } catch {
    return; // File may have been deleted or moved
  }

  const lastOffset = offsets.get(sessionFile) ?? 0;
  if (content.length <= lastOffset) return;

  const newContent = content.slice(lastOffset);
  offsets.set(sessionFile, content.length);

  // Only process if there's enough new content
  if (newContent.length < MIN_DELTA_BYTES) return;

  // Extract conversation text from JSONL transcript format
  const conversationText = extractConversationText(newContent);
  if (!conversationText) return;

  // Derive session key from file path
  const sessionKey = sessionFile.replace(/.*[/\\]/, "").replace(/\.\w+$/, "");

  await runExtractionPipeline({
    text: conversationText,
    manager,
    config,
    sessionKey,
  });
}

/**
 * Parse JSONL transcript lines and extract human-readable conversation text.
 * Transcript lines are JSON objects with role and content fields.
 */
function extractConversationText(rawContent: string): string | null {
  const lines = rawContent.split("\n").filter((l) => l.trim().length > 0);
  const textParts: string[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        role?: string;
        content?: string | Array<{ type: string; text?: string }>;
      };

      if (!entry.role || !entry.content) continue;

      // Skip system messages — they don't contain user-relevant memories
      if (entry.role === "system") continue;

      let text = "";
      if (typeof entry.content === "string") {
        text = entry.content;
      } else if (Array.isArray(entry.content)) {
        text = entry.content
          .filter((block) => block.type === "text" && block.text)
          .map((block) => block.text!)
          .join("\n");
      }

      if (text.trim()) {
        const label = entry.role === "user" ? "User" : "Assistant";
        textParts.push(`${label}: ${text.trim()}`);
      }
    } catch {
      // Not valid JSON — skip
    }
  }

  if (textParts.length === 0) return null;
  return textParts.join("\n\n");
}
