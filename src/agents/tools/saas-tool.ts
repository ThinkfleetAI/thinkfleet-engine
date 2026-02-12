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
  "task_list",
  "task_create",
  "task_update",
  "doc_search",
  "org_doc_search",
  "org_doc_list",
] as const;

const SaasToolSchema = Type.Object({
  action: stringEnum(SAAS_ACTIONS),
  appName: Type.Optional(Type.String()),
  cardId: Type.Optional(Type.String()),
  // Task fields
  taskId: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  priority: Type.Optional(Type.Number()),
  deliverables: Type.Optional(Type.String()),
  // Document search fields
  query: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  category: Type.Optional(Type.String()),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
});

export function createSaasTool(): AnyAgentTool {
  return {
    label: "SaaS",
    name: "saas",
    description: `Interact with the SaaS platform for task management, OAuth integrations, virtual cards, and document search.

ACTIONS:
- task_list: List tasks on your kanban board (optional: status filter)
- task_create: Create a new task (requires title; optional: description, priority, status)
- task_update: Update a task (requires taskId; optional: status, deliverables, description)
- integrations_list: List active OAuth integrations assigned to this agent
- integrations_get_token: Get an ephemeral OAuth token for a connected app (requires appName)
- integrations_connect: Initiate OAuth connection for a service (requires appName, returns redirect URL)
- card_list: List virtual cards assigned to this agent
- card_get: Get card details — number, CVC, expiry (requires cardId)
- doc_search: Search your agent-owned documents by query (requires query; optional: limit)
- org_doc_search: Search org-level documents assigned to you by query (requires query; optional: limit)
- org_doc_list: List all org-level documents assigned to you (optional: category filter)

PARAMETERS:
- taskId: Required for task_update
- title: Required for task_create
- description: Optional for task_create and task_update
- status: Optional filter for task_list; target status for task_update (todo, in_progress, delivered, done)
- priority: Optional for task_create (0 = highest)
- deliverables: Optional for task_update — summary of what was accomplished
- appName: Required for integrations_get_token and integrations_connect (e.g. "gmail", "slack", "google-drive")
- cardId: Required for card_get
- query: Required for doc_search and org_doc_search — semantic search query
- limit: Optional for doc_search and org_doc_search (default: 5)
- category: Optional for org_doc_list — filter by category (e.g. "knowledge", "writing_style")

USAGE NOTES:
- Use task_list to check your current tasks before starting work.
- When you finish a task, use task_update with status="delivered" and deliverables describing what you accomplished. The user will review and move it to "done".
- Tokens from integrations_get_token are ephemeral — do not store them. Request a fresh token each time.
- Card details from card_get are sensitive — use them only for the immediate purchase, never persist them.
- When users ask about uploaded documents or knowledge, use doc_search or org_doc_search to retrieve relevant content.
- Use org_doc_list to see all available org documents and their categories.`,
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

        case "task_list": {
          const status = readStringParam(params, "status");
          return jsonResult(
            await callGatewayTool("saas.task.list", gatewayOpts, { status: status || undefined }),
          );
        }

        case "task_create": {
          const title = readStringParam(params, "title", { required: true });
          const description = readStringParam(params, "description");
          const priority = typeof params.priority === "number" ? params.priority : undefined;
          const status = readStringParam(params, "status");
          return jsonResult(
            await callGatewayTool("saas.task.create", gatewayOpts, {
              title,
              description: description || undefined,
              priority,
              status: status || undefined,
            }),
          );
        }

        case "task_update": {
          const taskId = readStringParam(params, "taskId", { required: true });
          const status = readStringParam(params, "status");
          const deliverables = readStringParam(params, "deliverables");
          const description = readStringParam(params, "description");
          return jsonResult(
            await callGatewayTool("saas.task.update", gatewayOpts, {
              taskId,
              status: status || undefined,
              deliverables: deliverables || undefined,
              description: description || undefined,
            }),
          );
        }

        case "doc_search": {
          const query = readStringParam(params, "query", { required: true });
          const limit = typeof params.limit === "number" ? params.limit : 5;
          return jsonResult(
            await callGatewayTool("saas.documents.search", gatewayOpts, { query, limit }),
          );
        }

        case "org_doc_search": {
          const query = readStringParam(params, "query", { required: true });
          const limit = typeof params.limit === "number" ? params.limit : 5;
          return jsonResult(
            await callGatewayTool("saas.org-docs.search", gatewayOpts, { query, limit }),
          );
        }

        case "org_doc_list": {
          const category = readStringParam(params, "category");
          return jsonResult(
            await callGatewayTool("saas.org-docs.list", gatewayOpts, {
              category: category || undefined,
            }),
          );
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
