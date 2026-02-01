import { useEffect, useRef, useCallback } from "react";

interface HeartbeatConfig {
  saasUrl: string;
  deviceId: string;
  authToken: string;
  configVersion: number;
  onConfigUpdate: (config: Record<string, unknown>) => void;
  onCommand: (command: string) => void;
  intervalMs?: number;
}

export function useHeartbeat({
  saasUrl,
  deviceId,
  authToken,
  configVersion,
  onConfigUpdate,
  onCommand,
  intervalMs = 60_000,
}: HeartbeatConfig) {
  const configVersionRef = useRef(configVersion);
  configVersionRef.current = configVersion;

  const sendHeartbeat = useCallback(async () => {
    try {
      // Gather health info
      const health = {
        uptime: performance.now() / 1000,
        configVersion: configVersionRef.current,
        gatewayStatus: "running",
        audioStatus: "ready",
      };

      const res = await fetch(`${saasUrl}/api/assistants/devices/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, authToken, health }),
      });

      if (!res.ok) return;
      const data = await res.json();

      // Check if config needs updating
      if (data.needsConfigUpdate) {
        const configRes = await fetch(`${saasUrl}/api/assistants/devices/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, authToken }),
        });

        if (configRes.ok) {
          const config = await configRes.json();
          onConfigUpdate(config);
        }
      }

      // Check for pending commands
      if (data.pendingCommand) {
        onCommand(data.pendingCommand);
      }
    } catch (err) {
      console.error("[heartbeat] Failed:", err);
    }
  }, [saasUrl, deviceId, authToken, onConfigUpdate, onCommand]);

  useEffect(() => {
    // Send initial heartbeat
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, intervalMs);
    return () => clearInterval(interval);
  }, [sendHeartbeat, intervalMs]);
}
