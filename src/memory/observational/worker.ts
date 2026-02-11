/**
 * Observational Memory Background Worker.
 *
 * Listens to session transcript updates and runs the Observer/Reflector
 * pipeline when token thresholds are exceeded. Follows the same pattern
 * as extraction-worker.ts: debounced, non-blocking, event-driven.
 */

import fs from "node:fs/promises";

import type { AgentMessage } from "@mariozechner/pi-agent-core";

import type { ThinkfleetConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { onSessionTranscriptUpdate } from "../../sessions/transcript-events.js";
import { runObserver } from "./observer.js";
import { runReflector } from "./reflector.js";
import type { ObservationStore } from "./store.js";
import type { ObservationalWorkerHandle, ResolvedObservationalConfig } from "./types.js";

const log = createSubsystemLogger("observational-worker");

const DEFAULT_DEBOUNCE_MS = 10_000;
const MIN_DELTA_BYTES = 1_000;

export function startObservationalWorker(params: {
  store: ObservationStore;
  config: ResolvedObservationalConfig;
  cfg?: ThinkfleetConfig;
  /** Only process transcript files whose path contains this session key. */
  sessionKey?: string;
}): ObservationalWorkerHandle {
  const { store, config } = params;
  const debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;

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
        await processSessionFile(sessionFile, fileOffsets, store, config, params.cfg);
      } catch (err) {
        log.debug(`observational worker error for ${sessionFile}: ${String(err)}`);
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

    // If a specific session key is configured, only process matching files
    if (params.sessionKey && !update.sessionFile.includes(params.sessionKey)) {
      return;
    }

    pendingFiles.add(update.sessionFile);

    if (debounceTimer) return; // Already debouncing
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void processFiles();
    }, debounceMs);
  });

  log.debug("observational worker started");

  return {
    stop: () => {
      stopped = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      unsubscribe();
      log.debug("observational worker stopped");
    },
  };
}

/**
 * Read a session transcript file, reconstruct messages, and run Observer/Reflector
 * if enough new content has accumulated.
 */
async function processSessionFile(
  sessionFile: string,
  offsets: Map<string, number>,
  store: ObservationStore,
  config: ResolvedObservationalConfig,
  cfg?: ThinkfleetConfig,
): Promise<void> {
  let content: string;
  try {
    content = await fs.readFile(sessionFile, "utf-8");
  } catch {
    return; // File may have been deleted or moved
  }

  const lastOffset = offsets.get(sessionFile) ?? 0;
  if (content.length - lastOffset < MIN_DELTA_BYTES) return;

  // Parse ALL messages (not just delta) because Observer needs full message list
  // to track high water mark positions
  const messages = parseTranscriptMessages(content);
  if (messages.length === 0) return;

  // Update offset to avoid re-reading unchanged content on next check
  offsets.set(sessionFile, content.length);

  // Derive session key from file path
  const sessionKey = sessionFile.replace(/.*[/\\]/, "").replace(/\.\w+$/, "");

  // Run Observer
  await runObserver({
    messages,
    sessionKey,
    store,
    config,
    cfg,
  });

  // Run Reflector if needed
  await runReflector({
    sessionKey,
    store,
    config,
    cfg,
  });
}

/**
 * Parse JSONL transcript lines into AgentMessage[].
 */
function parseTranscriptMessages(content: string): AgentMessage[] {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const messages: AgentMessage[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        role?: string;
        content?: string | Array<{ type: string; text?: string }>;
        timestamp?: number;
      };

      if (!entry.role || !entry.content) continue;
      if (entry.role === "system") continue;

      if (entry.role === "user") {
        messages.push({
          role: "user",
          content: typeof entry.content === "string" ? entry.content : entry.content,
          timestamp: entry.timestamp ?? Date.now(),
        } as AgentMessage);
      } else if (entry.role === "assistant") {
        // Reconstruct as simplified text content for token estimation
        let text = "";
        if (typeof entry.content === "string") {
          text = entry.content;
        } else if (Array.isArray(entry.content)) {
          text = entry.content
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text!)
            .join("\n");
        }
        if (text) {
          messages.push({
            role: "assistant",
            content: [{ type: "text", text }],
            timestamp: entry.timestamp ?? Date.now(),
          } as AgentMessage);
        }
      }
    } catch {
      // Not valid JSON — skip
    }
  }

  return messages;
}
