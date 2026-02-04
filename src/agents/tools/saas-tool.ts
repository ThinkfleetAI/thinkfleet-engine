import { Type } from "@sinclair/typebox";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

const SAAS_ACTIONS = [
  "integrations_list",
  "integrations_get_token",
  "integrations_connect",
  "card_list",
  "card_get",
] as const;

const SaasToolSchema = Type.Object({
  action: stringEnum(SAAS_ACTIONS),
  appName: Type.Optional(Type.String()),
  cardId: Type.Optional(Type.String()),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
});

export function createSaasTool(): AnyAgentTool {
  return {
    label: "SaaS",
    name: "saas",
    description: `Interact with the SaaS platform for OAuth integrations and virtual cards.

ACTIONS:
- integrations_list: List active OAuth integrations assigned to this agent
- integrations_get_token: Get an ephemeral OAuth token for a connected app (requires appName)
- integrations_connect: Initiate OAuth connection for a service (requires appName, returns redirect URL)
- card_list: List virtual cards assigned to this agent
- card_get: Get card details — number, CVC, expiry (requires cardId)

PARAMETERS:
- appName: Required for integrations_get_token and integrations_connect (e.g. "gmail", "slack", "google-drive")
- cardId: Required for card_get

USAGE NOTES:
- Tokens from integrations_get_token are ephemeral — do not store them. Request a fresh token each time.
- Card details from card_get are sensitive — use them only for the immediate purchase, never persist them.
- Call integrations_list first to see what integrations are available before requesting tokens.
- Call card_list first to see assigned cards before requesting card details.`,
    parameters: SaasToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: readStringParam(params, "gatewayUrl", { trim: false }),
        gatewayToken: readStringParam(params, "gatewayToken", { trim: false }),
        timeoutMs: typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
      };

      switch (action) {
        case "integrations_list":
          return jsonResult(await callGatewayTool("saas.integrations.list", gatewayOpts, {}));

        case "integrations_get_token": {
          const appName = readStringParam(params, "appName", { required: true });
          return jsonResult(
            await callGatewayTool("saas.integrations.getToken", gatewayOpts, { appName }),
          );
        }

        case "integrations_connect": {
          const appName = readStringParam(params, "appName", { required: true });
          return jsonResult(
            await callGatewayTool("saas.integrations.connect", gatewayOpts, { appName }),
          );
        }

        case "card_list":
          return jsonResult(await callGatewayTool("saas.card.list", gatewayOpts, {}));

        case "card_get": {
          const cardId = readStringParam(params, "cardId", { required: true });
          return jsonResult(await callGatewayTool("saas.card.get", gatewayOpts, { cardId }));
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
