/**
 * Tool Catalog System
 *
 * Enables Cursor-style dynamic tool loading where agents start with
 * minimal tools and load categories on-demand.
 *
 * Files:
 * - tool-categories.ts: Defines categories and their tools
 * - load-tools-tool.ts: Meta-tool for loading categories
 * - generate-catalog.ts: Script to generate TOOLS_CATALOG.md
 */

export {
  TOOL_CATEGORIES,
  CORE_TOOLS,
  getToolsForCategories,
  getAllTools,
  getCategoryForTool,
  type ToolCategory,
  type ToolCategoryDefinition,
} from "./tool-categories.js";

export { createLoadToolsTool } from "./load-tools-tool.js";
