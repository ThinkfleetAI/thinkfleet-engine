import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/ipc";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [saasUrl, setSaasUrl] = useState("");
  const [agentMode, setAgentMode] = useState<"standalone" | "saas">("standalone");

  useEffect(() => {
    api.auth.getSession().then((session) => {
      setIsAuthenticated(session.isAuthenticated);
      setSaasUrl(session.saasUrl);
      setAgentMode(session.agentMode as "standalone" | "saas");
    });
  }, []);

  const login = useCallback(async (url: string) => {
    await api.auth.login(url);
    setIsAuthenticated(true);
    setSaasUrl(url);
    setAgentMode("saas");
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setIsAuthenticated(false);
    setSaasUrl("");
    setAgentMode("standalone");
  }, []);

  const switchMode = useCallback(
    async (mode: "standalone" | "saas") => {
      await api.settings.set("agentMode", mode);
      setAgentMode(mode);
    },
    [],
  );

  return {
    isAuthenticated,
    saasUrl,
    agentMode,
    login,
    logout,
    switchMode,
  };
}
