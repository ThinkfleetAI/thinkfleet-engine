/**
 * GUI Screenshot Tool
 *
 * Captures a screenshot of the desktop.
 */

import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ThinkfleetPluginToolContext } from "thinkfleetbot/plugin-sdk";

import { getClient } from "../client.js";
import { isDesktopPlatform, getPlatformName } from "../platform.js";

const GuiScreenshotSchema = Type.Object({
  annotate_elements: Type.Optional(
    Type.Boolean({
      description:
        "If true, annotate interactive UI elements on the screenshot. " +
        "Useful for understanding what can be clicked or interacted with.",
      default: false,
    }),
  ),
});

type GuiScreenshotParams = {
  annotate_elements?: boolean;
};

export function createGuiScreenshotTool(
  ctx: ThinkfleetPluginToolContext,
): AgentTool<typeof GuiScreenshotSchema, unknown> | null {
  if (!isDesktopPlatform()) {
    return null;
  }

  return {
    name: "gui_screenshot",
    description:
      "Capture a screenshot of the desktop. " +
      "Optionally annotate interactive UI elements to show what can be clicked. " +
      "Useful for understanding the current state of the desktop before automation.",
    inputSchema: GuiScreenshotSchema,

    async handler(params: Record<string, unknown>): Promise<AgentToolResult> {
      const typedParams = params as GuiScreenshotParams;
      const { annotate_elements = false } = typedParams;

      if (!isDesktopPlatform()) {
        return {
          type: "text",
          content:
            "Error: Screenshots require the ThinkFleet desktop app. " +
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
        const result = await client.screenshot(annotate_elements);

        if (!result.ok || !result.image) {
          return {
            type: "text",
            content: `Screenshot failed: ${result.error || "Unknown error"}`,
          };
        }

        const platform = getPlatformName();
        let content = `Screenshot captured (${result.width}x${result.height}, ${platform})`;

        if (annotate_elements && result.elements && result.elements.length > 0) {
          content += `\n\nDetected ${result.elements.length} interactive elements.`;
        }

        return {
          type: "mixed",
          content: [
            { type: "text", content },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: result.image,
              },
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          type: "text",
          content: `Screenshot error: ${message}`,
        };
      }
    },
  };
}
