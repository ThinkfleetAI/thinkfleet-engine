import type { ThinkFleetBotPluginApi } from "thinkfleetbot/plugin-sdk";
import { emptyPluginConfigSchema } from "thinkfleetbot/plugin-sdk";

import { officePlugin } from "./src/channel.js";
import { setOfficeRuntime } from "./src/runtime.js";

const plugin = {
	id: "office",
	name: "Microsoft Office",
	description: "Microsoft Office Add-in channel plugin (Excel, Word, Outlook, PowerPoint)",
	configSchema: emptyPluginConfigSchema(),
	register(api: ThinkFleetBotPluginApi) {
		setOfficeRuntime(api.runtime);
		api.registerChannel({ plugin: officePlugin });
	},
};

export default plugin;
