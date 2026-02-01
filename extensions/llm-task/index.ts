import type { ThinkFleetBotPluginApi } from "../../src/plugins/types.js";

import { createLlmTaskTool } from "./src/llm-task-tool.js";

export default function register(api: ThinkFleetBotPluginApi) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
