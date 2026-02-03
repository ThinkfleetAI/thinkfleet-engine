import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/ipc";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [agentMode, setAgentMode] = useState<"standalone" | "saas">("standalone");

  useEffect(() => {
    api.auth.getSession().then((session) => {
      setIsAuthenticated(session.isAuthenticated);
      setDeviceId(session.deviceId);
      setAgentMode(session.agentMode as "standalone" | "saas");
    });
  }, []);

  const registerDevice = useCallback(async (inviteCode: string) => {
    return await api.auth.registerDevice(inviteCode);
  }, []);

  const pollStatus = useCallback(async (devId: string, pairingToken: string) => {
    const result = await api.auth.pollStatus(devId, pairingToken);
    if (result.status === "ACTIVE") {
      setIsAuthenticated(true);
      setDeviceId(devId);
      setAgentMode("saas");
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setIsAuthenticated(false);
    setDeviceId("");
    setAgentMode("standalone");
  }, []);

  return {
    isAuthenticated,
    deviceId,
    agentMode,
    registerDevice,
    pollStatus,
    logout,
  };
}
