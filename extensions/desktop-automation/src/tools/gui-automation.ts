/**
 * GUI Automation Tool
 *
 * Executes natural language GUI automation tasks on the desktop.
 */

import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ThinkfleetPluginToolContext } from "thinkfleetbot/plugin-sdk";

import { getClient } from "../client.js";
import { isDesktopPlatform, getPlatformName } from "../platform.js";

const GuiAutomationSchema = Type.Object({
  task: Type.String({
    description:
      "Natural language description of the GUI task to perform. " +
      "Examples: 'Open Notepad and type Hello World', " +
      "'Create a new Excel spreadsheet with a budget table', " +
      "'Send an email to john@example.com with subject Test'",
  }),
  app: Type.Optional(
    Type.String({
      description:
        "Target application name. If not specified, the automation will " +
        "determine the appropriate application based on the task.",
    }),
  ),
  wait_for_completion: Type.Optional(
    Type.Boolean({
      description: "Wait for the task to complete before returning. Default: true",
      default: true,
    }),
  ),
  timeout_sec: Type.Optional(
    Type.Number({
      description: "Timeout in seconds. Default: 120",
      default: 120,
      minimum: 1,
      maximum: 600,
    }),
  ),
});

type GuiAutomationParams = {
  task: string;
  app?: string;
  wait_for_completion?: boolean;
  timeout_sec?: number;
};

export function createGuiAutomationTool(
  ctx: ThinkfleetPluginToolContext,
): AgentTool<typeof GuiAutomationSchema, unknown> | null {
  if (!isDesktopPlatform()) {
    return null;
  }

  return {
    name: "gui_automation",
    description:
      "Execute GUI automation tasks on the desktop. " +
      "Controls Windows and macOS applications through natural language commands. " +
      "Can open applications, click buttons, type text, navigate menus, and more. " +
      "Only available on desktop platforms (Windows, macOS). " +
      "Destructive actions (file saves, sends, deletes) may require user approval.",
    inputSchema: GuiAutomationSchema,

    async handler(params: Record<string, unknown>): Promise<AgentToolResult> {
      const typedParams = params as GuiAutomationParams;
      const { task, app, wait_for_completion = true, timeout_sec = 120 } = typedParams;

      if (!task || typeof task !== "string" || !task.trim()) {
        return {
          type: "text",
          content: "Error: task parameter is required and must be a non-empty string.",
        };
      }

      // Check platform
      if (!isDesktopPlatform()) {
        return {
          type: "text",
          content:
            "Error: GUI automation requires the ThinkFleet desktop app. " +
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
            "The sidecar should be started automatically by the desktop app. " +
            "If running manually, start it with:\n" +
            "  python tools/desktop-automation/server.py",
        };
      }

      try {
        const result = await client.execute({
          task: task.trim(),
          app_target: app?.trim(),
          timeout_sec,
          approval_mode: "destructive", // Default to requiring approval for destructive actions
          screenshot_after: true,
        });

        if (!result.ok) {
          return {
            type: "text",
            content: `GUI automation failed: ${result.error || "Unknown error"}\n` +
              (result.error_code ? `Error code: ${result.error_code}` : ""),
          };
        }

        // Build response
        let content = `GUI automation completed successfully.\n\n`;
        content += `Task: ${task}\n`;
        if (app) content += `Application: ${app}\n`;
        content += `Status: ${result.status || "completed"}\n`;
        if (result.steps_completed !== undefined && result.steps_total !== undefined) {
          content += `Steps: ${result.steps_completed}/${result.steps_total}\n`;
        }
        if (result.result) {
          content += `\nResult: ${result.result}\n`;
        }

        // Include screenshot if available
        if (result.screenshots?.after) {
          return {
            type: "mixed",
            content: [
              { type: "text", content },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: result.screenshots.after,
                },
              },
            ],
          };
        }

        return { type: "text", content };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          type: "text",
          content: `GUI automation error: ${message}`,
        };
      }
    },
  };
}
