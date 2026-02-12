import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

export type ToolAuditOutcome = "allowed" | "approved" | "rejected" | "blocked" | "timeout";

export type ToolAuditEntry = {
  ts: number;
  toolName: string;
  action: "allow" | "ask" | "deny";
  outcome: ToolAuditOutcome;
  matchedRule?: string;
  source: "rule" | "default";
  agentId?: string;
  sessionKey?: string;
  argsSummary?: string;
  responseTimeMs?: number;
  resolvedBy?: string;
};

const MAX_ARGS_SUMMARY_LENGTH = 200;

/**
 * Resolve the audit log file path.
 * Per-agent: <stateDir>/agents/<agentId>/tool-audit.jsonl
 * Global:    <stateDir>/tool-audit.jsonl
 */
export function resolveAuditLogPath(scope: "per-agent" | "global", agentId?: string): string {
  const stateDir = resolveStateDir();
  if (scope === "per-agent" && agentId) {
    return path.join(stateDir, "agents", agentId, "tool-audit.jsonl");
  }
  return path.join(stateDir, "tool-audit.jsonl");
}

/**
 * Append a single audit entry to the JSONL log (append-only, immutable).
 */
export function appendAuditEntry(entry: ToolAuditEntry, logPath: string): void {
  const line = JSON.stringify(entry) + "\n";
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, line, { mode: 0o600 });
}

/**
 * Truncate tool args into a short summary string for the audit log.
 */
export function summarizeArgs(args: unknown): string {
  if (args === undefined || args === null) return "";
  try {
    const raw = typeof args === "string" ? args : JSON.stringify(args);
    if (raw.length <= MAX_ARGS_SUMMARY_LENGTH) return raw;
    return raw.slice(0, MAX_ARGS_SUMMARY_LENGTH) + "...";
  } catch {
    return "[unserializable]";
  }
}
