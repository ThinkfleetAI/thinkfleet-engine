/**
 * Observational Memory pi-coding-agent extension.
 *
 * Hooks into the `context` event to replace observed messages with a dense
 * observation block. The observation block is a stable prefix (good for prompt
 * caching) while recent messages remain as a volatile suffix.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ContextEvent, ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

import type { Observation } from "../../../memory/observational/types.js";
import { getObservationalMemoryRuntime } from "./runtime.js";

export default function observationalMemoryExtension(api: ExtensionAPI): void {
  api.on("context", (event: ContextEvent, ctx: ExtensionContext) => {
    const runtime = getObservationalMemoryRuntime(ctx.sessionManager);
    if (!runtime) return undefined;

    const observations = runtime.store.getForSession(runtime.sessionKey);
    if (observations.length === 0) return undefined;

    const highWaterMark = runtime.store.getHighWaterMark(runtime.sessionKey);
    if (highWaterMark <= 0) return undefined;

    const messages = event.messages as AgentMessage[];

    // If high water mark exceeds current message count, something is off — bail
    if (highWaterMark > messages.length) return undefined;

    // Build the observation block as a single user message
    const observationText = buildObservationBlock(observations);
    const observationMessage: AgentMessage = {
      role: "user",
      content: observationText,
      timestamp: observations[0].createdAt,
    };

    // Keep only messages after the high water mark (unobserved)
    const recentMessages = messages.slice(highWaterMark);

    // Observation block (stable prefix) + recent messages (volatile suffix)
    return { messages: [observationMessage, ...recentMessages] };
  });
}

/**
 * Build a single text block from all observations, ordered by time,
 * wrapped in `<observation_context>` tags for clear delineation.
 */
function buildObservationBlock(observations: Observation[]): string {
  const entries = observations.map((obs) => {
    const date = new Date(obs.createdAt).toISOString().slice(0, 16).replace("T", " ");
    const priority = obs.priority >= 8 ? "HIGH" : obs.priority >= 5 ? "MED" : "LOW";
    return `[${date}] [${priority}] ${obs.content}`;
  });

  return [
    "<observation_context>",
    "The following are compressed observations from earlier in this conversation.",
    "They replace the original messages to save context space.",
    "",
    ...entries,
    "</observation_context>",
  ].join("\n");
}
