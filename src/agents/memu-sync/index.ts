/**
 * MemU Auto-Memorize — Listens for session transcript updates and forwards
 * new conversation turns to the MemU sidecar for background learning.
 *
 * This module mirrors how MemoryIndexManager subscribes to transcript events,
 * but instead of indexing locally it POSTs to the MemU REST API.
 */

import fs from "node:fs/promises";
import { onSessionTranscriptUpdate } from "../../sessions/transcript-events.js";
import type { ResolvedMemuConfig } from "../memu-config.js";

type SessionState = {
  lastByteOffset: number;
  timer: ReturnType<typeof setTimeout> | null;
};

const sessions = new Map<string, SessionState>();
let unsubscribe: (() => void) | null = null;

/**
 * Start the auto-memorize listener. Call once at gateway startup.
 * Returns a cleanup function.
 */
export function startMemuAutoMemorize(config: ResolvedMemuConfig): () => void {
  if (!config.enabled || !config.autoMemorize) return () => {};
  if (unsubscribe) return unsubscribe;

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const debounceMs = config.debounceMs;

  unsubscribe = onSessionTranscriptUpdate(({ sessionFile }) => {
    let state = sessions.get(sessionFile);
    if (!state) {
      state = { lastByteOffset: 0, timer: null };
      sessions.set(sessionFile, state);
    }

    // Debounce: wait for burst of updates to settle
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      void flushSession(baseUrl, sessionFile, state!);
    }, debounceMs);
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    for (const state of sessions.values()) {
      if (state.timer) clearTimeout(state.timer);
    }
    sessions.clear();
  };
}

async function flushSession(
  baseUrl: string,
  sessionFile: string,
  state: SessionState,
): Promise<void> {
  try {
    const stat = await fs.stat(sessionFile).catch(() => null);
    if (!stat || stat.size <= state.lastByteOffset) return;

    // Read only the new bytes since last flush
    const handle = await fs.open(sessionFile, "r");
    try {
      const newSize = stat.size - state.lastByteOffset;
      const buffer = Buffer.alloc(newSize);
      await handle.read(buffer, 0, newSize, state.lastByteOffset);
      state.lastByteOffset = stat.size;

      const newContent = buffer.toString("utf-8").trim();
      if (!newContent) return;

      // Extract message content from JSONL lines
      const messages: string[] = [];
      for (const line of newContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const entry = JSON.parse(trimmed);
          if (entry.type === "message" && entry.message?.content) {
            const role = entry.message.role ?? "unknown";
            const content =
              typeof entry.message.content === "string"
                ? entry.message.content
                : JSON.stringify(entry.message.content);
            messages.push(`[${role}] ${content}`);
          }
        } catch {
          // Skip malformed lines
        }
      }

      if (messages.length === 0) return;

      // Send batched content to MemU
      await fetch(`${baseUrl}/memorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: messages.join("\n"),
          modality: "conversation",
          user_id: "default",
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } finally {
      await handle.close();
    }
  } catch {
    // Silently ignore failures — MemU is optional
  }
}
