/**
 * GUI Plan Tool
 *
 * Generates an execution plan for a GUI automation task without executing it.
 */

import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ThinkfleetPluginToolContext } from "thinkfleetbot/plugin-sdk";

import { getClient } from "../client.js";
import { isDesktopPlatform } from "../platform.js";

const GuiPlanSchema = Type.Object({
  task: Type.String({
    description:
      "Natural language description of the GUI task to plan. " +
      "The plan will show what actions would be taken without executing them.",
  }),
  app: Type.Optional(
    Type.String({
      description: "Target application name.",
    }),
  ),
});

type GuiPlanParams = {
  task: string;
  app?: string;
};

export function createGuiPlanTool(
  ctx: ThinkfleetPluginToolContext,
): AgentTool<typeof GuiPlanSchema, unknown> | null {
  if (!isDesktopPlatform()) {
    return null;
  }

  return {
    name: "gui_plan",
    description:
      "Generate an execution plan for a GUI automation task without executing it. " +
      "Shows what actions would be taken, which applications would be used, " +
      "and which steps might require user approval. " +
      "Use this to preview complex automation tasks before running them.",
    inputSchema: GuiPlanSchema,

    async handler(params: Record<string, unknown>): Promise<AgentToolResult> {
      const typedParams = params as GuiPlanParams;
      const { task, app } = typedParams;

      if (!task || typeof task !== "string" || !task.trim()) {
        return {
          type: "text",
          content: "Error: task parameter is required and must be a non-empty string.",
        };
      }

      if (!isDesktopPlatform()) {
        return {
          type: "text",
          content:
            "Error: GUI planning requires the ThinkFleet desktop app. " +
            "This feature is not available in container deployments.",
        };
      }

      const client = getClient();

      // Check sidecar status
      const status = await client.status();
      if (!status.ok || !status.ready) {
        return {
          type: "text",
          content:
            `Error: Desktop automation sidecar not ready. ${status.error || ""}\n\n` +
            "The sidecar should be started automatically by the desktop app.",
        };
      }

      try {
        const result = await client.plan({
          task: task.trim(),
          app_target: app?.trim(),
        });

        if (!result.ok) {
          return {
            type: "text",
            content: `Planning failed: ${result.error || "Unknown error"}`,
          };
        }

        // Build response
        let content = `## Execution Plan\n\n`;
        content += `**Task:** ${task}\n`;
        if (app) content += `**Target App:** ${app}\n`;
        if (result.estimated_duration_sec) {
          content += `**Estimated Duration:** ${result.estimated_duration_sec}s\n`;
        }
        if (result.apps_involved && result.apps_involved.length > 0) {
          content += `**Applications Involved:** ${result.apps_involved.join(", ")}\n`;
        }
        content += `\n### Steps\n\n`;

        if (result.plan && result.plan.length > 0) {
          for (const step of result.plan) {
            const approvalBadge = step.requires_approval ? " ⚠️ (requires approval)" : "";
            const riskBadge =
              step.risk_level === "high"
                ? " 🔴"
                : step.risk_level === "medium"
                  ? " 🟡"
                  : "";

            content += `${step.step_number}. **${step.action_type}** on ${step.app}${riskBadge}${approvalBadge}\n`;
            content += `   ${step.description}\n\n`;
          }
        } else {
          content += "*No steps generated. The task may be too simple or unclear.*\n";
        }

        return { type: "text", content };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          type: "text",
          content: `Planning error: ${message}`,
        };
      }
    },
  };
}
