/**
 * Lazy MCP server bootstrap.
 *
 * Starts configured MCP servers once (on first call) and returns their tools.
 * Subsequent calls return the cached tools without restarting servers.
 */

import type { ThinkfleetConfig } from "../config/config.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { startMcpServers, stopAllMcpServers } from "./lifecycle.js";
import type { McpServerConfig } from "./client.js";

let cachedTools: AnyAgentTool[] | null = null;
let bootPromise: Promise<AnyAgentTool[]> | null = null;

/**
 * Bootstrap MCP servers from config. Returns cached tools if already started.
 */
export async function bootMcpTools(
  config: ThinkfleetConfig | undefined,
  log: (msg: string) => void = () => {},
): Promise<AnyAgentTool[]> {
  if (cachedTools) return cachedTools;
  if (bootPromise) return bootPromise;

  const servers = (config?.mcp?.servers ?? []) as McpServerConfig[];
  if (servers.length === 0) return [];

  bootPromise = startMcpServers(servers, log)
    .then((tools) => {
      cachedTools = tools;
      bootPromise = null;
      return tools;
    })
    .catch((err) => {
      log(`MCP boot failed: ${err}`);
      bootPromise = null;
      return [];
    });

  return bootPromise;
}

/**
 * Shutdown all MCP servers and clear cached tools.
 */
export async function shutdownMcp(log?: (msg: string) => void): Promise<void> {
  cachedTools = null;
  bootPromise = null;
  await stopAllMcpServers(log);
}
