/**
 * MCP server lifecycle management.
 *
 * Starts/stops MCP server processes and provides their tools
 * for inclusion in the agent tool set.
 */

import type { AnyAgentTool } from "../agents/tools/common.js";
import { McpStdioClient, type McpServerConfig } from "./client.js";
import { getMcpToolsFromClient } from "./registry.js";

const activeClients = new Map<string, McpStdioClient>();

/**
 * Start MCP servers from config and return all their tools.
 */
export async function startMcpServers(
  servers: McpServerConfig[],
  log: (msg: string) => void = () => {},
): Promise<AnyAgentTool[]> {
  const allTools: AnyAgentTool[] = [];

  for (const config of servers) {
    if (activeClients.has(config.id)) {
      log(`MCP server ${config.id} already running, skipping`);
      continue;
    }

    try {
      log(`Starting MCP server: ${config.id} (${config.command})`);
      const client = new McpStdioClient(config);

      client.on("log", (msg: string) => log(`[mcp:${config.id}] ${msg.trimEnd()}`));
      client.on("error", (err: Error) => log(`[mcp:${config.id}] error: ${err.message}`));
      client.on("exit", (code: number | null) => {
        log(`[mcp:${config.id}] exited with code ${code}`);
        activeClients.delete(config.id);
      });

      await client.start();
      activeClients.set(config.id, client);

      const tools = await getMcpToolsFromClient(client);
      log(`MCP server ${config.id}: registered ${tools.length} tools`);
      allTools.push(...tools);
    } catch (err) {
      log(
        `Failed to start MCP server ${config.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return allTools;
}

/**
 * Stop all running MCP servers.
 */
export async function stopAllMcpServers(log: (msg: string) => void = () => {}): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [id, client] of activeClients) {
    log(`Stopping MCP server: ${id}`);
    promises.push(client.stop().catch((err) => log(`Error stopping ${id}: ${err}`)));
  }
  await Promise.all(promises);
  activeClients.clear();
}

/**
 * Stop a specific MCP server by ID.
 */
export async function stopMcpServer(id: string): Promise<void> {
  const client = activeClients.get(id);
  if (client) {
    await client.stop();
    activeClients.delete(id);
  }
}

/**
 * Get IDs of all currently running MCP servers.
 */
export function getActiveMcpServerIds(): string[] {
  return Array.from(activeClients.keys());
}
