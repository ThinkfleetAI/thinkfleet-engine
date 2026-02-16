/**
 * SaaS bridge client for visual memory CRUD operations.
 * Follows the same pattern as saas-bridge.ts (saasFetch).
 */

import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { StoreVisualMemoryParams, VisualMemoryResult } from "./types.js";
import { getAccessToken } from "../../saas/oauth-token-client.js";

const log = createSubsystemLogger("visual-memory-client");

const SAAS_BASE =
  process.env.THINKFLEET_API_URL ||
  process.env.THINKFLEET_PROXY_BASE_URL ||
  process.env.THINKFLEET_PROXY_BASE_URL_LEGACY ||
  "";
const AGENT_DB_ID = process.env.THINKFLEET_AGENT_DB_ID || "";

const BRIDGE_PATH = "/api/internal/bridge/visual-memory";

async function bridgeFetch(body: unknown): Promise<{ ok: boolean; data: unknown }> {
  if (!SAAS_BASE) {
    throw new Error("SAAS_BASE not configured — cannot reach visual memory bridge");
  }

  const accessToken = await getAccessToken();
  const res = await fetch(`${SAAS_BASE}${BRIDGE_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Agent-Id": AGENT_DB_ID,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw new Error(`visual memory bridge error: ${msg}`);
  }

  return { ok: res.ok, data };
}

/** Store a visual memory entity in SaaS pgvector. */
export async function storeVisualMemory(params: StoreVisualMemoryParams): Promise<string> {
  const { data } = await bridgeFetch({
    action: "store",
    ...params,
  });
  return (data as { id: string }).id;
}

/** Search visual memories by semantic similarity. */
export async function searchVisualMemories(params: {
  query: string;
  senderId?: string;
  entityType?: string;
  limit?: number;
}): Promise<VisualMemoryResult[]> {
  try {
    const { data } = await bridgeFetch({
      action: "search",
      ...params,
    });
    return (data as { results: VisualMemoryResult[] }).results ?? [];
  } catch (err) {
    log.debug(`visual memory search failed: ${String(err)}`);
    return [];
  }
}

/** List visual memories with optional filters. */
export async function listVisualMemories(params?: {
  senderId?: string;
  entityType?: string;
  limit?: number;
}): Promise<VisualMemoryResult[]> {
  try {
    const { data } = await bridgeFetch({
      action: "list",
      ...params,
    });
    return (data as { results: VisualMemoryResult[] }).results ?? [];
  } catch (err) {
    log.debug(`visual memory list failed: ${String(err)}`);
    return [];
  }
}

/** Delete a visual memory by ID. */
export async function deleteVisualMemory(id: string): Promise<boolean> {
  try {
    const { data } = await bridgeFetch({
      action: "delete",
      id,
    });
    return (data as { deleted: boolean }).deleted;
  } catch (err) {
    log.debug(`visual memory delete failed: ${String(err)}`);
    return false;
  }
}
