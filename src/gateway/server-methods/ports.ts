import { execFile } from "node:child_process";
import type { GatewayRequestHandlers } from "./types.js";

const BLOCKED_PORTS = new Set([22, 18789]);

interface DetectedPort {
  port: number;
  label?: string;
}

function execAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

async function scanListeningPorts(): Promise<DetectedPort[]> {
  try {
    const output = await execAsync("ss", ["-tlnp"]);
    return parseSsOutput(output);
  } catch {
    try {
      const output = await execAsync("cat", ["/proc/net/tcp"]);
      return parseProcNetTcp(output);
    } catch {
      return [];
    }
  }
}

function parseSsOutput(output: string): DetectedPort[] {
  const ports: DetectedPort[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/LISTEN\s+\d+\s+\d+\s+(?:\*|[\d.]+|\[::\]):(\d+)/);
    if (!match) continue;
    const port = parseInt(match[1], 10);
    if (isNaN(port) || BLOCKED_PORTS.has(port) || port > 32767) continue;
    let label: string | undefined;
    const procMatch = line.match(/users:\(\("([^"]+)"/);
    if (procMatch) label = procMatch[1];
    if (!ports.some((p) => p.port === port)) ports.push({ port, label });
  }
  return ports;
}

function parseProcNetTcp(output: string): DetectedPort[] {
  const ports: DetectedPort[] = [];
  for (const line of output.split("\n").slice(1)) {
    const fields = line.trim().split(/\s+/);
    if (!fields[1] || !fields[3] || fields[3] !== "0A") continue;
    const [, portHex] = fields[1].split(":");
    if (!portHex) continue;
    const port = parseInt(portHex, 16);
    if (isNaN(port) || BLOCKED_PORTS.has(port) || port > 32767) continue;
    if (!ports.some((p) => p.port === port)) ports.push({ port });
  }
  return ports;
}

export const portsHandlers: GatewayRequestHandlers = {
  "ports.list": async ({ respond }) => {
    try {
      const ports = await scanListeningPorts();
      respond(true, { ports });
    } catch (err) {
      respond(false, undefined, {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Failed to scan ports",
      });
    }
  },
};
