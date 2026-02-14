/**
 * Proactive memory retrieval hook for the agent runner.
 *
 * When extraction-based proactive retrieval is enabled, fetches relevant
 * memories from the native memory system and prepends them to the user's
 * message before the agent turn. This gives the agent personalized context
 * without the user needing to explicitly request it.
 */

import type { ThinkfleetConfig } from "../../config/config.js";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { resolveMemorySearchConfig } from "../../agents/memory-search.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { searchVisualMemories } from "../../memory/visual/index.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("memory-proactive");

const MAX_CONTEXT_CHARS = 2000;

export async function runProactiveMemuRetrieveIfNeeded(params: {
  cfg: ThinkfleetConfig;
  commandBody: string;
  sessionKey?: string;
  senderId?: string;
}): Promise<string> {
  const agentId = resolveSessionAgentId({
    sessionKey: params.sessionKey,
    config: params.cfg,
  });

  const searchConfig = resolveMemorySearchConfig(params.cfg, agentId);
  if (!searchConfig?.extraction?.enabled || !searchConfig.extraction.proactiveRetrieval) {
    return params.commandBody;
  }

  const trimmed = params.commandBody.trim();

  // Skip very short messages — not enough signal for meaningful retrieval
  if (trimmed.length < 10) return params.commandBody;

  // Skip obvious commands
  if (trimmed.startsWith("/") || trimmed.startsWith("!")) return params.commandBody;

  try {
    const { manager } = await getMemorySearchManager({
      cfg: params.cfg,
      agentId,
    });
    if (!manager) return params.commandBody;

    const maxItems = searchConfig.extraction.maxProactiveItems;
    const minScore = searchConfig.extraction.minRelevanceScore;

    const items = await manager.searchMemoryItems({
      query: trimmed,
      maxResults: maxItems,
      minScore,
    });

    // Also search visual memories for this user
    let visualParts: string[] = [];
    try {
      const visualItems = await searchVisualMemories({
        query: trimmed,
        senderId: params.senderId,
        limit: 3,
      });
      for (const item of visualItems) {
        if (item.score < 0.3) continue;
        const label = item.entityName ? `${item.entityName} (${item.entityType})` : item.entityType;
        visualParts.push(`- [visual: ${label}] ${item.description}`);
      }
    } catch {
      // non-fatal — visual memory search is best-effort
    }

    if (items.length === 0 && visualParts.length === 0) return params.commandBody;

    // Format memory context
    const parts: string[] = [];
    let totalChars = 0;

    for (const item of items) {
      const line = `- [${item.memory_type}] ${item.content}`;
      if (totalChars + line.length > MAX_CONTEXT_CHARS) break;
      parts.push(line);
      totalChars += line.length;
    }

    // Append visual memories
    for (const vLine of visualParts) {
      if (totalChars + vLine.length > MAX_CONTEXT_CHARS) break;
      parts.push(vLine);
      totalChars += vLine.length;
    }

    if (parts.length === 0) return params.commandBody;

    const memoryContext = [
      "[Memory context — relevant information recalled from previous interactions]",
      ...parts,
      "[End memory context]",
    ].join("\n");

    return `${memoryContext}\n\n${params.commandBody}`;
  } catch (err) {
    log.debug(`proactive retrieval failed: ${String(err)}`);
    return params.commandBody;
  }
}
