/**
 * MemU integration for the agent runner — proactive retrieval hook.
 *
 * Resolves MemU config and, when proactive mode is enabled, fetches
 * relevant memories to prepend to the user's message before the agent turn.
 */

import type { ThinkfleetConfig } from "../../config/config.js";
import { resolveMemuConfigForSession } from "../../agents/memu-config.js";
import { proactiveMemuRetrieve } from "../../agents/memu-sync/proactive-retrieve.js";

export async function runProactiveMemuRetrieveIfNeeded(params: {
  cfg: ThinkfleetConfig;
  commandBody: string;
  sessionKey?: string;
  senderId?: string;
}): Promise<string> {
  const memuCfg = resolveMemuConfigForSession({
    config: params.cfg,
    sessionKey: params.sessionKey,
  });

  if (!memuCfg || !memuCfg.proactive) return params.commandBody;

  const memoryContext = await proactiveMemuRetrieve({
    config: memuCfg,
    userMessage: params.commandBody,
    userId: params.senderId ?? "default",
  });

  if (!memoryContext) return params.commandBody;

  // Prepend memory context before the user's message
  return `${memoryContext}\n\n${params.commandBody}`;
}
