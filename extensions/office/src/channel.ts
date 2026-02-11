import {
	getChatChannelMeta,
	type ChannelPlugin,
} from "thinkfleetbot/plugin-sdk";

import { getOfficeRuntime } from "./runtime.js";
import { createExcelTools } from "./tools/excel-tools.js";

/**
 * Resolved Office account from config.
 * Office is SaaS-managed — the add-in connects via the SaaS gateway,
 * so there's minimal bot-side account config.
 */
export interface ResolvedOfficeAccount {
	accountId: string;
	name: string;
	enabled: boolean;
}

const meta = getChatChannelMeta("office") ?? {
	id: "office",
	label: "Microsoft Office",
	selectionLabel: "Microsoft Office (Add-in)",
	docsPath: "/channels/office",
	docsLabel: "office",
	blurb: "Chat with your AI assistant from inside Excel, Word, Outlook, and PowerPoint.",
	systemImage: "table",
};

export const officePlugin: ChannelPlugin<ResolvedOfficeAccount> = {
	id: "office",
	meta: {
		...meta,
	},

	capabilities: {
		chatTypes: ["direct"],
		media: true,
		blockStreaming: true,
	},

	reload: { configPrefixes: ["channels.office"] },

	config: {
		listAccountIds: (cfg) => {
			const accounts = cfg.channels?.office?.accounts;
			if (accounts && typeof accounts === "object") {
				return Object.keys(accounts);
			}
			return cfg.channels?.office ? ["default"] : [];
		},
		resolveAccount: (cfg, accountId) => {
			const id = accountId ?? "default";
			const officeConfig = cfg.channels?.office;
			return {
				accountId: id,
				name: (officeConfig as Record<string, unknown>)?.name as string ?? "Office Add-in",
				enabled: officeConfig?.enabled !== false,
			};
		},
		defaultAccountId: () => "default",
		isConfigured: (account) => account.enabled,
		describeAccount: (account) => ({
			accountId: account.accountId,
			name: account.name,
			enabled: account.enabled,
			configured: true,
		}),
	},

	outbound: {
		deliveryMode: "gateway", // SaaS-managed: replies go through the SaaS gateway
		textChunkLimit: 4000,
	},

	// Agent tools: these are the tools the AI agent calls to generate Office.js action payloads
	agentTools: () => [
		...createExcelTools(),
	],

	// Gateway: no-op since this is SaaS-managed (add-in connects to SaaS, not bot)
	gateway: {
		startAccount: async (ctx) => {
			ctx.log?.info(`[office] Channel is SaaS-managed, no local monitor needed`);
		},
	},
};
