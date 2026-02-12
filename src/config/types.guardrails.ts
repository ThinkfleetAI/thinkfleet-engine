export type ToolGuardrailAction = "allow" | "ask" | "deny";

export type ToolGuardrailRule = {
  /** Tool name, glob pattern, or group:name (e.g., "group:fs", "web_*", "exec"). */
  match: string;
  /** Action to take when tool is invoked. */
  action: ToolGuardrailAction;
};

export type ToolGuardrailAuditConfig = {
  enabled?: boolean;
  /** "per-agent" stores under agent state dir; "global" stores in state root. Default: per-agent. */
  scope?: "per-agent" | "global";
};

export type ToolGuardrailsConfig = {
  /** Enable tool guardrails. Default: false (backward compat). */
  enabled?: boolean;
  /** Default action for tools not matched by any rule. Default: "allow". */
  defaultAction?: ToolGuardrailAction;
  /** Ordered rules; first match wins. */
  rules?: ToolGuardrailRule[];
  /** Timeout (ms) for ASK decisions before auto-deny. Default: 120000. */
  askTimeoutMs?: number;
  /** Enable JSONL audit trail. Default: true when guardrails enabled. */
  audit?: boolean | ToolGuardrailAuditConfig;
  /** Enable stats tracking. Default: true when guardrails enabled. */
  stats?: boolean;
};
