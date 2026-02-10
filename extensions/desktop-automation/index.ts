import type { ThinkFleetBotPluginApi } from "thinkfleetbot/plugin-sdk";
import { emptyPluginConfigSchema } from "thinkfleetbot/plugin-sdk";

import { createGuiAutomationTool } from "./src/tools/gui-automation.js";
import { createGuiPlanTool } from "./src/tools/gui-plan.js";
import { createGuiScreenshotTool } from "./src/tools/gui-screenshot.js";
import { isDesktopPlatform } from "./src/platform.js";

const desktopAutomationPlugin = {
  id: "desktop-automation",
  name: "Desktop Automation",
  description: "GUI automation for Windows and macOS desktop applications",
  configSchema: emptyPluginConfigSchema(),

  register(api: ThinkFleetBotPluginApi) {
    // Register tools as optional (require explicit enablement)
    api.registerTool(
      (ctx) => {
        // Only available on desktop platforms
        if (!isDesktopPlatform()) {
          return null;
        }

        // Check if sandboxed (container mode)
        if (ctx.sandboxed) {
          return null;
        }

        const tools = [];

        const guiAutomation = createGuiAutomationTool(ctx);
        if (guiAutomation) tools.push(guiAutomation);

        const guiPlan = createGuiPlanTool(ctx);
        if (guiPlan) tools.push(guiPlan);

        const guiScreenshot = createGuiScreenshotTool(ctx);
        if (guiScreenshot) tools.push(guiScreenshot);

        return tools.length > 0 ? tools : null;
      },
      {
        names: ["gui_automation", "gui_plan", "gui_screenshot"],
        optional: true, // Require explicit enablement in tool policy
      },
    );
  },
};

export default desktopAutomationPlugin;
