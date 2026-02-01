import type { ThinkFleetBotPluginApi } from "../../src/plugins/types.js";

import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: ThinkFleetBotPluginApi) {
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) return null;
      return createLobsterTool(api);
    },
    { optional: true },
  );
}
