import fs from "node:fs/promises";
import path from "node:path";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { DEFAULT_AGENT_WORKSPACE_DIR } from "../../agents/workspace.js";
import type { GatewayRequestHandlers } from "./types.js";

const MIME_MAP: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

/**
 * Resolve a requested path safely within the workspace directory.
 * Prevents directory traversal attacks.
 */
function resolveSafePath(requestedPath: string): string | null {
  const resolved = path.resolve(DEFAULT_AGENT_WORKSPACE_DIR, requestedPath);
  if (!resolved.startsWith(DEFAULT_AGENT_WORKSPACE_DIR)) return null;
  return resolved;
}

/**
 * Search recursively for a file by name within the workspace.
 * Returns the first match found (breadth-first), or null.
 */
async function findFileInWorkspace(filename: string, maxDepth = 5): Promise<string | null> {
  const queue: Array<{ dir: string; depth: number }> = [
    { dir: DEFAULT_AGENT_WORKSPACE_DIR, depth: 0 },
  ];
  while (queue.length > 0) {
    const { dir, depth } = queue.shift()!;
    if (depth > maxDepth) continue;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === filename) return full;
        if (entry.isDirectory()) queue.push({ dir: full, depth: depth + 1 });
      }
    } catch {
      // skip unreadable directories
    }
  }
  return null;
}

export const filesHandlers: GatewayRequestHandlers = {
  /**
   * Read a file from the agent workspace.
   * params: { path: string, encoding?: "base64" | "utf8" }
   * returns: { content: string, size: number, mimeType: string }
   */
  "files.read": async ({ params, respond }) => {
    const filePath = params.path as string | undefined;
    if (!filePath) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path is required"));
      return;
    }

    const resolved = resolveSafePath(filePath);
    if (!resolved) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    try {
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "not a file"));
        return;
      }

      // Limit to 10MB
      if (stat.size > 10 * 1024 * 1024) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "file too large (max 10MB)"),
        );
        return;
      }

      const encoding = (params.encoding as string) === "base64" ? "base64" : "utf8";
      const content = await fs.readFile(resolved, { encoding });
      const mimeType = getMimeType(resolved);

      respond(true, { content, size: stat.size, mimeType });
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // If it's a bare filename, search the workspace for it
        const basename = path.basename(filePath);
        if (!filePath.includes("/") || filePath === basename) {
          const found = await findFileInWorkspace(basename);
          if (found && found.startsWith(DEFAULT_AGENT_WORKSPACE_DIR)) {
            try {
              const stat2 = await fs.stat(found);
              if (stat2.isFile() && stat2.size <= 10 * 1024 * 1024) {
                const encoding = (params.encoding as string) === "base64" ? "base64" : "utf8";
                const content = await fs.readFile(found, { encoding });
                respond(true, { content, size: stat2.size, mimeType: getMimeType(found) });
                return;
              }
            } catch {
              // fall through to not found
            }
          }
        }
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "file not found"));
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `read error: ${err.message}`),
        );
      }
    }
  },

  /**
   * List files in a directory within the agent workspace.
   * params: { path?: string }
   * returns: { files: Array<{ name, path, size, mimeType, isDirectory }> }
   */
  /**
   * Publish a file as a task deliverable.
   * Broadcasts a "task.file" event so connected SaaS clients can fetch and store it.
   * params: { path: string, taskId?: string, description?: string, sessionKey?: string }
   */
  "files.publish": async ({ params, respond, context }) => {
    const filePath = params.path as string | undefined;
    if (!filePath) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path is required"));
      return;
    }

    const resolved = resolveSafePath(filePath);
    if (!resolved) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    // Verify file exists
    try {
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "not a file"));
        return;
      }

      const mimeType = getMimeType(resolved);
      const filename = path.basename(resolved);

      // Broadcast event to all connected clients (SaaS will pick this up)
      context.broadcast("task.file", {
        path: filePath,
        filename,
        mimeType,
        size: stat.size,
        taskId: params.taskId as string | undefined,
        description: params.description as string | undefined,
        sessionKey: params.sessionKey as string | undefined,
      });

      respond(true, { published: true, filename, mimeType, size: stat.size });
    } catch (err: any) {
      if (err.code === "ENOENT") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "file not found"));
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `publish error: ${err.message}`),
        );
      }
    }
  },

  "files.list": async ({ params, respond }) => {
    const dirPath = (params.path as string) || ".";
    const resolved = resolveSafePath(dirPath);
    if (!resolved) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const files = await Promise.all(
        entries
          .filter((e) => !e.name.startsWith("."))
          .map(async (entry) => {
            const fullPath = path.join(resolved, entry.name);
            const relativePath = path.relative(DEFAULT_AGENT_WORKSPACE_DIR, fullPath);
            try {
              const stat = await fs.stat(fullPath);
              return {
                name: entry.name,
                path: relativePath,
                size: stat.size,
                mimeType: entry.isDirectory() ? "directory" : getMimeType(entry.name),
                isDirectory: entry.isDirectory(),
              };
            } catch {
              return null;
            }
          }),
      );

      respond(true, { files: files.filter(Boolean) });
    } catch (err: any) {
      if (err.code === "ENOENT") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "directory not found"));
      } else {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `list error: ${err.message}`),
        );
      }
    }
  },
};
