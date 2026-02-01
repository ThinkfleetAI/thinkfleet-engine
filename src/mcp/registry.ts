/**
 * Converts MCP tool definitions into AnyAgentTool instances
 * compatible with the thinkfleet tool system.
 */

import { Type, type TObject } from "@sinclair/typebox";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { jsonResult } from "../agents/tools/common.js";
import type { McpStdioClient, McpToolDefinition } from "./client.js";

/**
 * Convert a JSON Schema object (from MCP) into a TypeBox TObject.
 * Handles common JSON Schema types; falls back to Type.Any() for unknowns.
 */
function jsonSchemaToTypebox(schema: Record<string, unknown> | undefined): TObject {
  if (!schema || schema.type !== "object") {
    // Fallback: accept any params
    return Type.Object({}, { additionalProperties: true });
  }

  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required ?? []) as string[]);
  const tbProps: Record<string, ReturnType<typeof convertProperty>> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const converted = convertProperty(prop);
    tbProps[key] = required.has(key) ? converted : Type.Optional(converted);
  }

  return Type.Object(tbProps);
}

function convertProperty(prop: Record<string, unknown>): any {
  const desc = prop.description as string | undefined;
  const opts = desc ? { description: desc } : {};

  switch (prop.type) {
    case "string":
      if (prop.enum)
        return Type.Union(
          (prop.enum as string[]).map((v) => Type.Literal(v)),
          opts,
        );
      return Type.String(opts);
    case "number":
    case "integer":
      return Type.Number(opts);
    case "boolean":
      return Type.Boolean(opts);
    case "array":
      return Type.Array(
        prop.items ? convertProperty(prop.items as Record<string, unknown>) : Type.Any(),
        opts,
      );
    case "object":
      return Type.Object({}, { ...opts, additionalProperties: true });
    default:
      return Type.Any(opts);
  }
}

/**
 * Create an AnyAgentTool from an MCP tool definition + client reference.
 * Tool names are prefixed with `mcp_{serverId}_` to avoid collisions.
 */
export function createMcpAgentTool(
  client: McpStdioClient,
  toolDef: McpToolDefinition,
): AnyAgentTool {
  const prefixedName = `mcp_${client.serverId}_${toolDef.name}`;
  const parameters = jsonSchemaToTypebox(toolDef.inputSchema);

  return {
    label: `MCP: ${toolDef.name}`,
    name: prefixedName,
    description: toolDef.description ?? `MCP tool: ${toolDef.name} (server: ${client.serverId})`,
    parameters,
    execute: async (_toolCallId, args) => {
      try {
        const result = await client.callTool(toolDef.name, args as Record<string, unknown>);
        // Convert MCP content to agent tool result
        const textParts = result.content
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text!)
          .join("\n");
        return jsonResult({ output: textParts || "(no output)" });
      } catch (err) {
        return jsonResult({
          status: "error",
          tool: prefixedName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

/**
 * Fetch all tools from an MCP client and convert them to AnyAgentTool[].
 */
export async function getMcpToolsFromClient(client: McpStdioClient): Promise<AnyAgentTool[]> {
  const toolDefs = await client.listTools();
  return toolDefs.map((def) => createMcpAgentTool(client, def));
}
