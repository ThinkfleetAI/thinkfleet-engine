/**
 * SaaS Bridge Gateway Handlers
 *
 * These methods allow the ThinkFleet chat agent to call back to the SaaS
 * platform for operations that live outside the container:
 * - Create/manage tasks on the kanban board
 * - Delegate complex work to Agent Zero
 * - Make outbound phone calls via Twilio (SaaS-provisioned numbers)
 * - Send SMS via provisioned numbers
 * - Manage contacts and escalation
 * - Query knowledge base / documents
 *
 * The SaaS sends RPCs TO the container. These methods go the other direction:
 * container calls the SaaS internal API using the gateway token.
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const SAAS_BASE =
  process.env.THINKFLEET_API_URL ||
  process.env.THINKFLEET_PROXY_BASE_URL ||
  process.env.CLAWDBOT_PROXY_BASE_URL ||
  "";
const GATEWAY_TOKEN = process.env.THINKFLEET_GATEWAY_TOKEN || "";
const AGENT_DB_ID = process.env.THINKFLEET_AGENT_DB_ID || "";

async function saasFetch(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; data: unknown }> {
  if (!SAAS_BASE) {
    return { ok: false, status: 0, data: { error: "SAAS_BASE not configured" } };
  }
  const res = await fetch(`${SAAS_BASE}${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${GATEWAY_TOKEN}`,
      "X-Agent-Id": AGENT_DB_ID,
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export const saasBridgeHandlers: GatewayRequestHandlers = {
  /**
   * Create a task on the SaaS kanban board.
   * The chat agent calls this when a user request should be tracked.
   */
  "saas.task.create": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/task", {
        method: "POST",
        body: {
          action: "create",
          title: params.title,
          description: params.description,
          priority: params.priority ?? 0,
          status: params.status ?? "todo",
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to create task"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Update a task on the kanban board (move status, add deliverables).
   */
  "saas.task.update": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/task", {
        method: "POST",
        body: {
          action: "update",
          taskId: params.taskId,
          status: params.status,
          deliverables: params.deliverables,
          description: params.description,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to update task"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * List tasks from the kanban board.
   */
  "saas.task.list": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/task", {
        method: "POST",
        body: {
          action: "list",
          status: params.status, // optional filter
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to list tasks"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Delegate a complex task to Agent Zero.
   * The chat agent creates an AZ task when it determines a request is too
   * complex for a single turn (research, multi-step code generation, etc.).
   */
  "saas.agentzero.delegate": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/agentzero", {
        method: "POST",
        body: {
          action: "delegate",
          goal: params.goal,
          constraints: params.constraints,
          context: params.context,
          templateId: params.templateId,
          variables: params.variables,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to delegate to AZ"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Check status of a delegated AZ task.
   */
  "saas.agentzero.status": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/agentzero", {
        method: "POST",
        body: {
          action: "status",
          taskId: params.taskId,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to get AZ status"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Make an outbound phone call via SaaS-provisioned Twilio number.
   */
  "saas.phone.call": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/phone", {
        method: "POST",
        body: {
          action: "call",
          to: params.to, // E.164 number
          message: params.message, // What to say when they answer
          purpose: params.purpose, // appointment, checkin, emergency, etc.
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to initiate call"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Send an SMS via SaaS-provisioned number.
   */
  "saas.phone.sms": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/phone", {
        method: "POST",
        body: {
          action: "sms",
          to: params.to,
          message: params.message,
        },
      });
      respond(ok, data, ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to send SMS"));
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Manage contacts — CRUD for the agent's contact list.
   */
  "saas.contacts.manage": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/contacts", {
        method: "POST",
        body: params, // { action: "list"|"add"|"update"|"remove", ...data }
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to manage contacts"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Trigger an escalation — notify emergency contacts via call/SMS.
   */
  "saas.escalate": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/escalate", {
        method: "POST",
        body: {
          reason: params.reason,
          severity: params.severity, // low, medium, high, emergency
          contactIds: params.contactIds, // specific contacts, or empty for all emergency contacts
          method: params.method, // call, sms, both
        },
      });
      respond(ok, data, ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to escalate"));
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Search the SaaS document/knowledge base.
   */
  "saas.documents.search": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/documents", {
        method: "POST",
        body: {
          action: "search",
          query: params.query,
          limit: params.limit ?? 5,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to search documents"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * List org-level documents assigned to this agent.
   */
  "saas.org-docs.list": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/documents", {
        method: "POST",
        body: {
          action: "org-docs.list",
          category: params.category,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to list org documents"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Search org-level documents assigned to this agent.
   */
  "saas.org-docs.search": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/documents", {
        method: "POST",
        body: {
          action: "org-docs.search",
          query: params.query,
          limit: params.limit ?? 5,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to search org documents"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Deliver a file from the agent to the org document repository.
   */
  "saas.org-docs.deliver": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/documents", {
        method: "POST",
        body: {
          action: "org-docs.deliver",
          filename: params.filename,
          content: params.content, // base64
          mimeType: params.mimeType,
          category: params.category ?? "deliverable",
          description: params.description,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to deliver document"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Proxy a request through the SaaS to a platform-managed service.
   * Platform API keys (Composio, Brave, etc.) never reach the container.
   */
  "saas.proxy.request": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/proxy", {
        method: "POST",
        body: {
          provider: params.provider,
          method: params.method,
          path: params.path,
          body: params.body,
          headers: params.headers,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Platform proxy failed"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * List connected OAuth integrations for the org.
   * Returns which services (Google Drive, Slack, etc.) the user has connected.
   */
  "saas.integrations.list": async ({ respond }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/integrations", {
        method: "POST",
        body: { action: "list" },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to list integrations"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Initiate an OAuth connection for a service.
   * Returns a redirect URL the user should visit to authorize.
   */
  "saas.integrations.connect": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/integrations", {
        method: "POST",
        body: {
          action: "connect",
          appName: params.appName,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to initiate connection"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Fetch an ephemeral OAuth token for a connected integration.
   * The token is retrieved live from Composio and should not be stored.
   */
  "saas.integrations.getToken": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/integrations", {
        method: "POST",
        body: {
          action: "get_token",
          appName: params.appName,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to get integration token"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  // ── Virtual Cards ──

  /**
   * List virtual cards assigned to this agent.
   */
  "saas.card.list": async ({ respond }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/card", {
        method: "POST",
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to list cards"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Get card details (PAN, CVC, expiry) for an assigned virtual card.
   * Card details are ephemeral and should not be stored.
   */
  "saas.card.get": async ({ respond, params }) => {
    try {
      const cardId = String(params.cardId ?? "");
      if (!cardId) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "cardId required"));
        return;
      }
      const { ok, data } = await saasFetch(
        `/api/internal/bridge/card?cardId=${encodeURIComponent(cardId)}`,
        {
          method: "GET",
        },
      );
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to get card details"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  // ── Crew Orchestration ──

  /**
   * Master agent submits a task decomposition plan for the crew.
   */
  "saas.crew.decompose": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "decompose_result",
          executionId: params.executionId,
          tasks: params.tasks,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to submit decomposition"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Master agent queries execution progress.
   */
  "saas.crew.taskStatus": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "task_status",
          executionId: params.executionId,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to get task status"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Master agent requests a task reassignment.
   */
  "saas.crew.reassign": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "reassign",
          taskId: params.taskId,
          reason: params.reason,
          preferredPersona: params.preferredPersona,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to reassign task"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Master agent sends a message to a specific crew member.
   */
  "saas.crew.sendToMember": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "send_to_member",
          executionId: params.executionId,
          targetAgentId: params.targetAgentId,
          message: params.message,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to send message to member"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Master agent submits final execution summary.
   */
  "saas.crew.summary": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "execution_summary",
          executionId: params.executionId,
          summary: params.summary,
          artifacts: params.artifacts,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to submit summary"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Child agent acknowledges a delegated task.
   */
  "saas.crew.task.ack": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "task_ack",
          taskId: params.taskId,
          accepted: params.accepted,
          reason: params.reason,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to acknowledge task"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Child agent reports task progress.
   */
  "saas.crew.task.progress": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "task_progress",
          taskId: params.taskId,
          status: params.status ?? "in_progress",
          progress: params.progress,
          message: params.message,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to report progress"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Child agent reports task completion.
   */
  "saas.crew.task.completed": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "task_completed",
          taskId: params.taskId,
          deliverables: params.deliverables,
          completionReport: params.completionReport,
          artifacts: params.artifacts,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to report completion"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Child agent reports a blocker.
   */
  "saas.crew.task.blocked": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "task_blocked",
          taskId: params.taskId,
          blockerDescription: params.blockerDescription,
        },
      });
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to report blocker"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },

  /**
   * Child agent requests lateral collaboration (e.g. dev asks QA for review).
   */
  "saas.crew.lateral.request": async ({ respond, params }) => {
    try {
      const { ok, data } = await saasFetch("/api/internal/bridge/crew", {
        method: "POST",
        body: {
          action: "lateral_request",
          taskId: params.taskId,
          targetPersona: params.targetPersona,
          requestType: params.requestType,
          payload: params.payload,
        },
      });
      respond(
        ok,
        data,
        ok
          ? undefined
          : errorShape(ErrorCodes.UNAVAILABLE, "Failed to request lateral collaboration"),
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `SaaS unreachable: ${err}`));
    }
  },
};
