import type { PluginRuntime } from "thinkfleetbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setOfficeRuntime(next: PluginRuntime) {
	runtime = next;
}

export function getOfficeRuntime(): PluginRuntime {
	if (!runtime) {
		throw new Error("Office runtime not initialized");
	}
	return runtime;
}
