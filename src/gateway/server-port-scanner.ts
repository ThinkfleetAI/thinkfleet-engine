/**
 * Port Scanner Service
 *
 * Periodically scans for listening TCP ports inside the container
 * and broadcasts "ports.detected" events to connected clients (SaaS backend).
 * This allows the SaaS reverse proxy to automatically discover and expose
 * applications that agents spin up (dev servers, APIs, etc.).
 */

import { execFile } from "node:child_process";

const PORT_SCAN_INTERVAL_MS = 10_000;
const BLOCKED_PORTS = new Set([22, 18789]);

interface DetectedPort {
  port: number;
  label?: string;
}

/**
 * Parse `ss -tlnp` output to extract listening TCP ports.
 * Falls back to reading /proc/net/tcp if ss is unavailable.
 */
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
  const lines = output.split("\n");

  for (const line of lines) {
    // Match lines like: LISTEN 0 128 *:3000 *:*
    // or: LISTEN 0 128 0.0.0.0:8080 0.0.0.0:*
    // or: LISTEN 0 128 [::]:5000 [::]:*
    const match = line.match(/LISTEN\s+\d+\s+\d+\s+(?:\*|[\d.]+|\[::\]):(\d+)/);
    if (!match) continue;

    const port = parseInt(match[1], 10);
    if (isNaN(port) || BLOCKED_PORTS.has(port)) continue;
    // Skip ephemeral ports (typically > 32767)
    if (port > 32767) continue;

    // Try to extract process name from the line
    let label: string | undefined;
    const procMatch = line.match(/users:\(\("([^"]+)"/);
    if (procMatch) {
      label = procMatch[1];
    }

    if (!ports.some((p) => p.port === port)) {
      ports.push({ port, label });
    }
  }

  return ports;
}

function parseProcNetTcp(output: string): DetectedPort[] {
  const ports: DetectedPort[] = [];
  const lines = output.split("\n").slice(1); // skip header

  for (const line of lines) {
    const fields = line.trim().split(/\s+/);
    if (!fields[1] || !fields[3]) continue;

    // State 0A = LISTEN
    if (fields[3] !== "0A") continue;

    const [, portHex] = fields[1].split(":");
    if (!portHex) continue;

    const port = parseInt(portHex, 16);
    if (isNaN(port) || BLOCKED_PORTS.has(port) || port > 32767) continue;

    if (!ports.some((p) => p.port === port)) {
      ports.push({ port });
    }
  }

  return ports;
}

function execAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/**
 * Start the port scanner. Returns a cleanup function to stop scanning.
 */
export function startPortScanner(params: {
  broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
}): { stop: () => void; interval: ReturnType<typeof setInterval> } {
  let lastPorts: string = "[]";

  const scan = async () => {
    try {
      const detected = await scanListeningPorts();
      const serialized = JSON.stringify(detected);

      // Only broadcast if ports changed
      if (serialized !== lastPorts) {
        lastPorts = serialized;
        params.broadcast("ports.detected", { ports: detected }, { dropIfSlow: true });
      }
    } catch {
      // Scanning failure is non-fatal, just skip this cycle
    }
  };

  // Run initial scan after a short delay (let services start up)
  const initialTimeout = setTimeout(() => void scan(), 5_000);

  const interval = setInterval(() => void scan(), PORT_SCAN_INTERVAL_MS);

  return {
    interval,
    stop: () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    },
  };
}
