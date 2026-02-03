/**
 * Agent Zero Gateway Handlers
 *
 * Thin HTTP proxy to the local Agent Zero FastAPI gateway at 127.0.0.1:9100.
 * These methods are invoked by the SaaS platform via the existing gateway WS channel.
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const AZ_HOST = process.env.AZ_GATEWAY_HOST ?? "127.0.0.1";
const AZ_PORT = process.env.AZ_GATEWAY_PORT ?? "9100";
const AZ_BASE = `http://${AZ_HOST}:${AZ_PORT}`;

async function azFetch(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${AZ_BASE}${path}`, {
    method: opts?.method ?? "GET",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export const agentZeroHandlers: GatewayRequestHandlers = {
  "agentzero.health": async ({ respond }) => {
    try {
      const { ok, data } = await azFetch("/health");
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Agent Zero unhealthy"),
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.task.create": async ({ respond, params }) => {
    try {
      const { ok, data } = await azFetch("/tasks", {
        method: "POST",
        body: params,
      });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to create task";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.task.get": async ({ respond, params }) => {
    const taskId = params.taskId;
    if (!taskId || typeof taskId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "taskId is required"));
      return;
    }
    try {
      const { ok, data, status } = await azFetch(`/tasks/${encodeURIComponent(taskId)}`);
      if (!ok) {
        const code = status === 404 ? ErrorCodes.INVALID_REQUEST : ErrorCodes.UNAVAILABLE;
        respond(false, undefined, errorShape(code, "Task not found"));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.task.cancel": async ({ respond, params }) => {
    const taskId = params.taskId;
    if (!taskId || typeof taskId !== "string") {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "taskId is required"));
      return;
    }
    try {
      const { ok, data } = await azFetch(`/tasks/${encodeURIComponent(taskId)}/cancel`, {
        method: "POST",
      });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to cancel task";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.settings.update": async ({ respond, params }) => {
    try {
      const { ok, data } = await azFetch("/api/settings_set", {
        method: "POST",
        body: params,
      });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to update settings";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.memory.export": async ({ respond }) => {
    try {
      const { ok, data } = await azFetch("/api/memory/export", { method: "POST" });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to export memory";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.memory.import": async ({ respond, params }) => {
    try {
      const { ok, data } = await azFetch("/api/memory/import", {
        method: "POST",
        body: params,
      });
      if (!ok) {
        const msg = (data as Record<string, unknown>)?.detail ?? "Failed to import memory";
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(msg)));
        return;
      }
      respond(true, data, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },

  "agentzero.task.list": async ({ respond }) => {
    try {
      const { ok, data } = await azFetch("/tasks");
      respond(
        ok,
        data,
        ok ? undefined : errorShape(ErrorCodes.UNAVAILABLE, "Failed to list tasks"),
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `Agent Zero unreachable: ${err}`),
      );
    }
  },
};
