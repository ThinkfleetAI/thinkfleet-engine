import type { ThinkfleetConfig } from "../config/config.js";
import type { ToolGuardrailsConfig } from "../config/types.guardrails.js";
import type { AnyAgentTool } from "../agents/pi-tools.types.js";
import type { ExecApprovalDecision } from "../infra/exec-approvals.js";
import { callGatewayTool } from "../agents/tools/gateway.js";
import {
  isExecApprovalActive,
  isToolGuardrailEnabled,
  resolveAuditConfig,
  resolveToolGuardrailPolicy,
  isStatsEnabled,
  type ToolGuardrailDecision,
} from "./tool-guardrails.js";
import {
  appendAuditEntry,
  resolveAuditLogPath,
  summarizeArgs,
  type ToolAuditEntry,
  type ToolAuditOutcome,
} from "./tool-audit-log.js";
import { toolGuardrailStats } from "./tool-guardrail-stats.js";
import { emitToolAuditEvent } from "../infra/outbound/saas-outbound.js";

type GuardrailContext = {
  config?: ThinkfleetConfig;
  sessionKey?: string;
};

const EXEC_TOOL_NAMES = new Set(["exec", "process"]);
const DEFAULT_ASK_TIMEOUT_MS = 120_000;

function resolveAgentIdFromConfig(config?: ThinkfleetConfig): string | undefined {
  // Use the first agent id from the agents config as a best-effort identifier.
  const agents = config?.agents;
  if (!agents) return undefined;
  const agentEntries = Object.entries(agents).filter(
    ([key]) => key !== "defaults" && key !== "default",
  );
  return agentEntries[0]?.[0];
}

function logDecision(
  decision: ToolGuardrailDecision,
  outcome: ToolAuditOutcome,
  ctx: GuardrailContext,
  extra?: {
    args?: unknown;
    responseTimeMs?: number;
    resolvedBy?: string;
  },
): void {
  const guardrailsConfig = ctx.config?.approvals?.tools;
  const auditConfig = resolveAuditConfig(guardrailsConfig);
  const statsEnabled = isStatsEnabled(guardrailsConfig);
  const agentId = resolveAgentIdFromConfig(ctx.config);

  const entry: ToolAuditEntry = {
    ts: Date.now(),
    toolName: decision.toolName,
    action: decision.action,
    outcome,
    matchedRule: decision.matchedRule,
    source: decision.source,
    agentId,
    sessionKey: ctx.sessionKey,
    argsSummary: extra?.args !== undefined ? summarizeArgs(extra.args) : undefined,
    responseTimeMs: extra?.responseTimeMs,
    resolvedBy: extra?.resolvedBy,
  };

  if (auditConfig.enabled) {
    try {
      const logPath = resolveAuditLogPath(auditConfig.scope, agentId);
      appendAuditEntry(entry, logPath);
    } catch {
      // Audit logging should never break tool execution.
    }
  }

  if (statsEnabled) {
    try {
      toolGuardrailStats.record(entry);
    } catch {
      // Stats tracking should never break tool execution.
    }
  }

  // Emit to SaaS audit log (fire-and-forget, best-effort)
  try {
    emitToolAuditEvent({
      toolName: entry.toolName,
      action: entry.action,
      outcome: entry.outcome,
      matchedRule: entry.matchedRule,
      source: entry.source,
      argsSummary: entry.argsSummary,
      responseTimeMs: entry.responseTimeMs,
      resolvedBy: entry.resolvedBy,
      sessionKey: entry.sessionKey,
    });
  } catch {
    // SaaS audit emission should never break tool execution.
  }
}

async function requestToolApproval(params: {
  toolName: string;
  args: unknown;
  ctx: GuardrailContext;
  decision: ToolGuardrailDecision;
}): Promise<{ decision: ExecApprovalDecision | null; responseTimeMs: number }> {
  const askTimeoutMs = params.ctx.config?.approvals?.tools?.askTimeoutMs ?? DEFAULT_ASK_TIMEOUT_MS;
  const startMs = Date.now();

  try {
    const result = (await callGatewayTool<{
      decision?: ExecApprovalDecision;
    }>(
      "exec.approval.request",
      { timeoutMs: askTimeoutMs + 5000 },
      {
        command: `Tool: ${params.toolName}`,
        description: `Execute tool "${params.toolName}" with args: ${summarizeArgs(params.args)}`,
        riskLevel: "medium",
        sessionKey: params.ctx.sessionKey,
        timeoutMs: askTimeoutMs,
      },
    )) as { decision?: ExecApprovalDecision } | undefined;

    return {
      decision: result?.decision ?? null,
      responseTimeMs: Date.now() - startMs,
    };
  } catch {
    return {
      decision: null,
      responseTimeMs: Date.now() - startMs,
    };
  }
}

/**
 * Wrap tools with ALLOW/ASK/DENY guardrails based on config.
 * When guardrails are disabled, returns tools unchanged (zero overhead).
 */
export function wrapToolsWithGuardrails(
  tools: AnyAgentTool[],
  ctx: GuardrailContext,
): AnyAgentTool[] {
  if (!isToolGuardrailEnabled(ctx.config)) return tools;

  const guardrailsConfig = ctx.config?.approvals?.tools;
  const resolve = resolveToolGuardrailPolicy(guardrailsConfig);
  const execApprovalActive = isExecApprovalActive(ctx.config);

  return tools.map((tool) => {
    const decision = resolve(tool.name);

    // Defer exec/process to the existing exec-approval system
    if (EXEC_TOOL_NAMES.has(decision.toolName) && execApprovalActive) {
      return tool;
    }

    // ALLOW: return original tool unwrapped (zero overhead per invocation)
    if (decision.action === "allow") {
      logDecision(decision, "allowed", ctx);
      return tool;
    }

    // DENY: replace execute with immediate rejection
    if (decision.action === "deny") {
      return {
        ...tool,
        execute: async () => {
          logDecision(decision, "blocked", ctx);
          return {
            content: [
              {
                type: "text" as const,
                text: `Tool "${tool.name}" is blocked by security policy.`,
              },
            ],
            details: {
              guardrail: "denied",
              toolName: tool.name,
              matchedRule: decision.matchedRule,
            },
          };
        },
      };
    }

    // ASK: wrap execute with approval gate
    const originalExecute = tool.execute;
    return {
      ...tool,
      execute: async (
        toolCallId: string,
        params: unknown,
        signal?: AbortSignal,
        onUpdate?: unknown,
      ) => {
        const { decision: approvalDecision, responseTimeMs } = await requestToolApproval({
          toolName: tool.name,
          args: params,
          ctx,
          decision,
        });

        if (approvalDecision === "deny" || approvalDecision === null) {
          const outcome: ToolAuditOutcome = approvalDecision === "deny" ? "rejected" : "timeout";
          logDecision(decision, outcome, ctx, {
            args: params,
            responseTimeMs,
          });
          return {
            content: [
              {
                type: "text" as const,
                text:
                  approvalDecision === "deny"
                    ? `Tool "${tool.name}" was denied by the approver.`
                    : `Tool "${tool.name}" approval timed out.`,
              },
            ],
            details: {
              guardrail: outcome,
              toolName: tool.name,
              responseTimeMs,
            },
          };
        }

        // Approved
        logDecision(decision, "approved", ctx, {
          args: params,
          responseTimeMs,
          resolvedBy: "user",
        });

        return await originalExecute.call(
          tool,
          toolCallId,
          params,
          signal,
          onUpdate as Parameters<typeof originalExecute>[3],
        );
      },
    };
  });
}
