/**
 * load_tools Meta-Tool
 *
 * Allows the agent to dynamically load additional tools by category.
 * This enables Cursor-style minimal tool loading where the agent starts
 * with a small footprint and expands as needed.
 *
 * Usage in agent:
 *   load_tools({ categories: ["files", "web"] })
 *
 * The tool returns a confirmation of which tools were loaded and
 * updates the session's available tools.
 */

import { Type } from "@sinclair/typebox";
import { type AnyAgentTool, textResult } from "../common.js";
import { TOOL_CATEGORIES, getToolsForCategories, type ToolCategory } from "./tool-categories.js";

const VALID_CATEGORIES = TOOL_CATEGORIES.map((c) => c.id);

const LoadToolsSchema = Type.Object({
  categories: Type.Array(
    Type.String({
      description: `Tool category to load. Valid: ${VALID_CATEGORIES.join(", ")}`,
    }),
    {
      description: "List of tool categories to load",
      minItems: 1,
    },
  ),
});

/**
 * Creates the load_tools meta-tool
 *
 * @param onLoadTools - Callback invoked when tools should be loaded.
 *                      The callback receives the list of tool names to add
 *                      and should return true if successful.
 */
export function createLoadToolsTool(
  onLoadTools?: (toolNames: string[]) => Promise<boolean> | boolean,
): AnyAgentTool {
  return {
    label: "Load Tools",
    name: "load_tools",
    description: `Load additional tools by category. Read TOOLS_CATALOG.md to see available categories.

CATEGORIES:
${TOOL_CATEGORIES.filter((c) => !c.alwaysLoaded)
  .map((c) => `- ${c.id}: ${c.description} (${c.tools.length} tools)`)
  .join("\n")}

USAGE:
- load_tools({ categories: ["files"] }) → loads file tools
- load_tools({ categories: ["web", "shell"] }) → loads multiple categories

After loading, new tools become available for use in this session.`,
    parameters: LoadToolsSchema,
    execute: async (_toolCallId, args) => {
      const params = args as { categories: string[] };
      const requestedCategories = params.categories ?? [];

      // Validate categories
      const invalidCategories = requestedCategories.filter(
        (c) => !VALID_CATEGORIES.includes(c as ToolCategory),
      );
      if (invalidCategories.length > 0) {
        return textResult(
          `Invalid categories: ${invalidCategories.join(", ")}\n` +
            `Valid categories: ${VALID_CATEGORIES.join(", ")}`,
        );
      }

      // Get tools for requested categories
      const validCategories = requestedCategories as ToolCategory[];
      const toolsToLoad = getToolsForCategories(validCategories);

      if (toolsToLoad.length === 0) {
        return textResult(
          `Categories ${validCategories.join(", ")} contain no additional tools.\n` +
            `These may be accessed through the 'saas' tool instead.`,
        );
      }

      // Call the load callback if provided
      if (onLoadTools) {
        const success = await onLoadTools(toolsToLoad);
        if (!success) {
          return textResult(
            `Failed to load tools. Some tools may not be available in this environment.`,
          );
        }
      }

      // Build response
      const categoryDetails = validCategories
        .map((cat) => {
          const def = TOOL_CATEGORIES.find((c) => c.id === cat);
          return def ? `- ${cat}: ${def.tools.join(", ")}` : `- ${cat}: (no tools)`;
        })
        .join("\n");

      return textResult(
        `Loaded ${toolsToLoad.length} tools from ${validCategories.length} categories:\n\n` +
          categoryDetails +
          `\n\nThese tools are now available for use.`,
      );
    },
  };
}
