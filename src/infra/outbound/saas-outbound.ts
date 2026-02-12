/**
 * SaaS Outbound Gateway Emitter
 *
 * Holds a reference to the gateway broadcaster so that the reply pipeline
 * (route-reply, followup-runner) can emit `channel.outbound` events for
 * SaaS-managed channels without importing gateway internals directly.
 *
 * Follows the same singleton-setter pattern as server/health-state.ts
 * (`setBroadcastHealthUpdate`).
 */

export type GatewayBroadcastFn = (
  event: string,
  payload: unknown,
  opts?: { dropIfSlow?: boolean },
) => void;

export type ChannelOutboundPayload = {
  channelType: string;
  target: string;
  text: string;
  mediaUrl?: string;
  replyToMessageId?: string;
  threadId?: string | number;
  metadata?: Record<string, unknown>;
  kind: string;
};

let gatewayBroadcast: GatewayBroadcastFn | null = null;

/**
 * Set the gateway broadcast function. Called once during gateway startup.
 */
export function setGatewayBroadcast(fn: GatewayBroadcastFn | null): void {
  gatewayBroadcast = fn;
}

/**
 * Check whether the gateway broadcaster is available.
 */
export function hasGatewayBroadcast(): boolean {
  return gatewayBroadcast !== null;
}

/**
 * Emit a `channel.outbound` event via the gateway broadcaster.
 * Returns true if the event was emitted, false if no broadcaster is available.
 */
export function emitChannelOutbound(payload: ChannelOutboundPayload): boolean {
  if (!gatewayBroadcast) return false;
  gatewayBroadcast("channel.outbound", payload);
  return true;
}

export type ToolAuditPayload = {
  toolName: string;
  action: "allow" | "ask" | "deny";
  outcome: string;
  matchedRule?: string;
  source: "rule" | "default";
  argsSummary?: string;
  responseTimeMs?: number;
  resolvedBy?: string;
  sessionKey?: string;
};

/**
 * Emit a `tool.audit` event via the gateway broadcaster.
 * Used by tool guardrails to send audit entries to the SaaS audit log.
 */
export function emitToolAuditEvent(payload: ToolAuditPayload): boolean {
  if (!gatewayBroadcast) return false;
  gatewayBroadcast("tool.audit", payload, { dropIfSlow: true });
  return true;
}
