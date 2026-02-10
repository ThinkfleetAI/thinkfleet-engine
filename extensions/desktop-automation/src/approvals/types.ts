/**
 * Types for GUI approval flow.
 */

export interface GuiApprovalRequest {
  requestId: string;
  sessionId: string;
  agentId: string;
  action: {
    type: string;
    app: string;
    target: string;
    parameters: Record<string, unknown>;
  };
  riskLevel: "low" | "medium" | "high";
  reason: string;
  screenshot?: string; // Base64 PNG
  timestamp: number;
}

export interface GuiApprovalResponse {
  requestId: string;
  decision: "approve" | "deny" | "approve-always";
  modifiedParameters?: Record<string, unknown>;
}

export interface GuiApprovalDialogData {
  request: GuiApprovalRequest;
  timeout: number; // ms
}
