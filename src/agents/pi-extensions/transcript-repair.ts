/**
 * Final safety-net extension: repairs tool_use / tool_result pairing
 * immediately before messages are sent to the LLM API.
 *
 * This catches mismatches introduced by auto-compaction, context pruning,
 * turn validation, history limiting, or any other transformation that runs
 * after the initial sanitization pipeline.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ContextEvent, ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { sanitizeToolUseResultPairing } from "../session-transcript-repair.js";

export default function transcriptRepairExtension(api: ExtensionAPI): void {
  api.on("context", (event: ContextEvent) => {
    const next = sanitizeToolUseResultPairing(event.messages as AgentMessage[]);
    if (next === event.messages) return undefined;
    return { messages: next };
  });
}
