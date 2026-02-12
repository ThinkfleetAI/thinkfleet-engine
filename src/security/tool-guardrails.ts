import type { ThinkfleetConfig } from "../config/config.js";
import type {
  ToolGuardrailAction,
  ToolGuardrailRule,
  ToolGuardrailsConfig,
} from "../config/types.guardrails.js";
import { TOOL_GROUPS, normalizeToolName } from "../agents/tool-policy.js";

export type ToolGuardrailDecision = {
  toolName: string;
  action: ToolGuardrailAction;
  /** Which rule matched (for audit trail). */
  matchedRule?: string;
  /** Whether decision came from an explicit rule or the default. */
  source: "rule" | "default";
};

// ── Built-in per-tool defaults (used when enabled with no explicit rules) ────

const BUILTIN_DEFAULTS: Record<string, ToolGuardrailAction> = {
  // group:fs — read is safe, mutations need approval
  read: "allow",
  write: "ask",
  edit: "ask",
  apply_patch: "ask",

  // group:runtime — defer to existing exec-approval system
  exec: "allow",
  process: "allow",

  // group:web — read-only by nature
  web_search: "allow",
  web_fetch: "allow",
  exa_answer: "allow",
  exa_research: "allow",
  exa_contents: "allow",

  // group:memory — agent's own memory
  memory_search: "allow",
  memory_get: "allow",
  memory_categories: "allow",

  // group:sessions — orchestration
  sessions_list: "allow",
  sessions_history: "allow",
  sessions_send: "allow",
  sessions_spawn: "allow",
  session_status: "allow",

  // group:ui
  browser: "allow",
  canvas: "allow",
  image: "allow",

  // group:messaging — sends external messages
  message: "ask",

  // group:automation — creates scheduled jobs, gateway calls
  cron: "ask",
  gateway: "ask",

  // group:nodes — device control
  nodes: "ask",
};

// ── Compiled rule matching ───────────────────────────────────────────────────

type CompiledRule = {
  /** Set of concrete tool names this rule matches. */
  toolNames: Set<string>;
  /** Original glob pattern (for tools not in known groups). */
  globPattern?: RegExp;
  action: ToolGuardrailAction;
  rawMatch: string;
};

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function compileRule(rule: ToolGuardrailRule): CompiledRule {
  const normalized = normalizeToolName(rule.match);

  // Check if it's a group reference
  const groupTools = TOOL_GROUPS[normalized];
  if (groupTools) {
    return {
      toolNames: new Set(groupTools),
      action: rule.action,
      rawMatch: rule.match,
    };
  }

  // Check if it contains glob characters
  if (normalized.includes("*") || normalized.includes("?")) {
    return {
      toolNames: new Set<string>(),
      globPattern: globToRegex(normalized),
      action: rule.action,
      rawMatch: rule.match,
    };
  }

  // Exact tool name
  return {
    toolNames: new Set([normalized]),
    action: rule.action,
    rawMatch: rule.match,
  };
}

function matchesRule(toolName: string, rule: CompiledRule): boolean {
  if (rule.toolNames.has(toolName)) return true;
  if (rule.globPattern) return rule.globPattern.test(toolName);
  return false;
}

// ── Public API ───────────────────────────────────────────────────────────────

export type ToolGuardrailMatcher = (toolName: string) => ToolGuardrailDecision;

/**
 * Compile guardrail config into a fast matcher function.
 * Call once per tool-list build; reuse for all tools in that set.
 */
export function resolveToolGuardrailPolicy(config?: ToolGuardrailsConfig): ToolGuardrailMatcher {
  const rules = (config?.rules ?? []).map(compileRule);
  const defaultAction: ToolGuardrailAction = config?.defaultAction ?? "allow";

  return (rawToolName: string): ToolGuardrailDecision => {
    const toolName = normalizeToolName(rawToolName);

    // Walk rules, first match wins
    for (const rule of rules) {
      if (matchesRule(toolName, rule)) {
        return {
          toolName,
          action: rule.action,
          matchedRule: rule.rawMatch,
          source: "rule",
        };
      }
    }

    // If no rules defined at all, use built-in defaults
    if (rules.length === 0) {
      const builtinAction = BUILTIN_DEFAULTS[toolName];
      if (builtinAction) {
        return {
          toolName,
          action: builtinAction,
          source: "default",
        };
      }
      // Unknown/plugin tools default to "ask" (fail-secure)
      return {
        toolName,
        action: "ask",
        source: "default",
      };
    }

    // Rules exist but none matched — use configured default
    return {
      toolName,
      action: defaultAction,
      source: "default",
    };
  };
}

/**
 * Quick check: are tool guardrails enabled in this config?
 */
export function isToolGuardrailEnabled(config?: ThinkfleetConfig): boolean {
  return config?.approvals?.tools?.enabled === true;
}

/**
 * Check if the existing exec-approval system is active for a given config.
 * When active, the guardrail defers exec/process tools to avoid double-prompting.
 */
export function isExecApprovalActive(config?: ThinkfleetConfig): boolean {
  const execConfig = config?.tools?.exec;
  if (!execConfig) return false;
  const security = execConfig.security ?? "deny";
  const ask = execConfig.ask ?? "on-miss";
  // Exec-approval is active when security isn't "deny" or ask isn't "off"
  return security !== "deny" || ask !== "off";
}

/**
 * Resolve the audit config from the guardrails config.
 */
export function resolveAuditConfig(config?: ToolGuardrailsConfig): {
  enabled: boolean;
  scope: "per-agent" | "global";
} {
  const audit = config?.audit;
  if (audit === false) return { enabled: false, scope: "per-agent" };
  if (audit === true || audit === undefined) {
    // Default: enabled when guardrails are enabled
    return { enabled: config?.enabled === true, scope: "per-agent" };
  }
  return {
    enabled: audit.enabled !== false,
    scope: audit.scope ?? "per-agent",
  };
}

/**
 * Check if stats tracking is enabled.
 */
export function isStatsEnabled(config?: ToolGuardrailsConfig): boolean {
  if (config?.stats !== undefined) return config.stats;
  // Default: enabled when guardrails are enabled
  return config?.enabled === true;
}
