import type { ThinkFleetBotPluginApi } from "thinkfleetbot/plugin-sdk";
import { emptyPluginConfigSchema } from "thinkfleetbot/plugin-sdk";

import { twitchPlugin } from "./src/plugin.js";
import { setTwitchRuntime } from "./src/runtime.js";

export { monitorTwitchProvider } from "./src/monitor.js";

const plugin = {
  id: "twitch",
  name: "Twitch",
  description: "Twitch channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: ThinkFleetBotPluginApi) {
    setTwitchRuntime(api.runtime);
    api.registerChannel({ plugin: twitchPlugin as any });
  },
};

export default plugin;
