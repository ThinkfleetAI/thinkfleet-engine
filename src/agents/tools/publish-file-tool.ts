import { Type } from "@sinclair/typebox";

import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

const PublishFileToolSchema = Type.Object({
  path: Type.String({
    description: "Relative path to the file in the workspace, e.g. 'presentations/report.html'",
  }),
  task_id: Type.Optional(
    Type.String({
      description:
        "The task ID this file belongs to, if known. Required for automatic attachment to task board.",
    }),
  ),
  description: Type.Optional(
    Type.String({
      description: "Brief description of the file for the user.",
    }),
  ),
});

export function createPublishFileTool(options?: { agentSessionKey?: string }): AnyAgentTool {
  return {
    name: "publish_file",
    description:
      "Publish a file from your workspace so it becomes downloadable in the SaaS dashboard. " +
      "Use this after creating a deliverable file (HTML, PDF, CSV, etc.) to make it available to the user. " +
      "The file must already exist in your workspace.",
    label: "Publish File",
    parameters: PublishFileToolSchema,
    async execute(_toolCallId: string, input: Record<string, unknown>) {
      const filePath = readStringParam(input, "path", { required: true });
      const taskId = readStringParam(input, "task_id");
      const description = readStringParam(input, "description");

      try {
        const gatewayOpts: GatewayCallOptions = { timeoutMs: 15_000 };

        // Broadcast a task.file event via the gateway so connected SaaS clients pick it up
        await callGatewayTool("files.publish", gatewayOpts, {
          path: filePath,
          taskId,
          description,
          sessionKey: options?.agentSessionKey,
        });

        return jsonResult({
          ok: true,
          message: `File "${filePath}" published successfully. It will appear in the task's attachments.`,
        });
      } catch (err: any) {
        return jsonResult({
          ok: false,
          error: err?.message ?? "Failed to publish file",
        });
      }
    },
  };
}
