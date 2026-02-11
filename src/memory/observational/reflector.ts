/**
 * Reflector Agent — Compresses existing observations into denser meta-observations.
 *
 * Triggered when total observation tokens exceed the configured threshold.
 * Atomically replaces generation-0 observations with compressed versions.
 */

import type { ThinkfleetConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { callExtractionLLM } from "../extraction-llm.js";
import { REFLECTOR_SYSTEM_PROMPT, parseObservations } from "./prompts.js";
import type { ObservationStore } from "./store.js";
import type { ResolvedObservationalConfig } from "./types.js";

const log = createSubsystemLogger("observational-reflector");

/**
 * Run the Reflector: compress generation-0 observations into generation-1.
 *
 * No-op if observation tokens are below the reflector threshold.
 */
export async function runReflector(params: {
  sessionKey: string;
  store: ObservationStore;
  config: ResolvedObservationalConfig;
  cfg?: ThinkfleetConfig;
}): Promise<void> {
  const { sessionKey, store, config } = params;

  const observations = store.getForSession(sessionKey, 0);
  if (observations.length <= 1) return;

  const totalTokens = observations.reduce((sum, o) => sum + o.tokenEstimate, 0);
  if (totalTokens < config.reflectorThresholdTokens) return;

  log.debug(
    `reflector triggered: ${observations.length} observations, ~${totalTokens} tokens (threshold: ${config.reflectorThresholdTokens})`,
  );

  // Serialize observations for the Reflector LLM
  const obsText = observations
    .map(
      (o) =>
        `[${new Date(o.createdAt).toISOString()}] (priority: ${o.priority}, messages ${o.messageStartIndex}-${o.messageEndIndex})\n${o.content}`,
    )
    .join("\n---\n");

  const response = await callExtractionLLM({
    systemPrompt: REFLECTOR_SYSTEM_PROMPT,
    userContent: obsText,
    cfg: params.cfg,
    llmConfig: {
      provider: config.provider,
      model: config.model,
      maxTokens: 4096,
      temperature: 0.1,
    },
  });

  // The meta-observations span the full range of the originals
  const first = observations[0];
  const last = observations[observations.length - 1];

  const metaObs = parseObservations(response, {
    sessionKey,
    messageStartIndex: first.messageStartIndex,
    messageEndIndex: last.messageEndIndex,
    generation: 1,
  });

  if (metaObs.length === 0) {
    log.debug("reflector produced no observations, keeping originals");
    return;
  }

  // Atomically replace gen-0 with gen-1 compressed observations
  store.replaceObservations(sessionKey, 0, metaObs);
  log.debug(`reflector compressed ${observations.length} observations into ${metaObs.length}`);
}
