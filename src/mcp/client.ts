/**
 * MCP (Model Context Protocol) JSON-RPC client over stdio transport.
 *
 * Spawns an MCP server as a child process and communicates via
 * newline-delimited JSON-RPC 2.0 messages on stdin/stdout.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export type McpServerConfig = {
  id: string;
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type McpToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
};

export class McpStdioClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = "";
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private _initialized = false;

  constructor(private config: McpServerConfig) {
    super();
  }

  get serverId(): string {
    return this.config.id;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  async start(): Promise<void> {
    const env = { ...process.env, ...(this.config.env ?? {}) };
    this.process = spawn(this.config.command, this.config.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      // MCP servers may log to stderr; emit for debugging
      this.emit("log", chunk.toString());
    });

    this.process.on("exit", (code) => {
      this.emit("exit", code);
      this.rejectAllPending(new Error(`MCP server ${this.config.id} exited with code ${code}`));
    });

    this.process.on("error", (err) => {
      this.emit("error", err);
      this.rejectAllPending(err);
    });

    // MCP initialize handshake
    const initResult = (await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "thinkfleet", version: "1.0.0" },
    })) as Record<string, unknown>;

    // Send initialized notification
    this.notify("notifications/initialized", {});
    this._initialized = true;

    return;
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = (await this.request("tools/list", {})) as { tools?: McpToolDefinition[] };
    return result.tools ?? [];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  }> {
    const result = (await this.request("tools/call", { name, arguments: args })) as {
      content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
      isError?: boolean;
    };
    if (result.isError) {
      const errorText =
        result.content?.find((c) => c.type === "text")?.text ?? "MCP tool call failed";
      throw new Error(errorText);
    }
    return { content: result.content ?? [] };
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    try {
      this.notify("notifications/cancelled", {});
    } catch {}
    this.process.kill("SIGTERM");
    // Give it a moment to exit gracefully
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.process?.kill("SIGKILL");
        resolve();
      }, 3000);
      this.process?.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.process = null;
    this._initialized = false;
  }

  private request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      this.pending.set(id, { resolve, reject });
      const msg: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
      this.send(msg);

      // Timeout after 30s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request ${method} timed out`));
        }
      }, 30000);
    });
  }

  private notify(method: string, params?: Record<string, unknown>): void {
    const msg: JsonRpcNotification = { jsonrpc: "2.0", method, params };
    this.send(msg);
  }

  private send(msg: JsonRpcRequest | JsonRpcNotification): void {
    if (!this.process?.stdin?.writable) {
      throw new Error(`MCP server ${this.config.id} stdin not writable`);
    }
    this.process.stdin.write(JSON.stringify(msg) + "\n");
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        if (msg.id !== undefined && this.pending.has(String(msg.id))) {
          const handler = this.pending.get(String(msg.id))!;
          this.pending.delete(String(msg.id));
          if (msg.error) {
            handler.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
          } else {
            handler.resolve(msg.result);
          }
        }
      } catch {
        // Ignore unparseable lines (could be server debug output)
      }
    }
  }

  private rejectAllPending(err: Error): void {
    for (const handler of this.pending.values()) {
      handler.reject(err);
    }
    this.pending.clear();
  }
}
