import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/ipc";
import type { AgentInfo } from "../../../preload/index";

export function useAgents(isAuthenticated: boolean) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setAgents([]);
      return;
    }
    setLoading(true);
    try {
      const list = await api.agents.list();
      setAgents(list);
      // Auto-select first agent if none selected
      if (!selectedAgentId && list.length > 0) {
        setSelectedAgentId(list[0]!.agentId);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedAgentId]);

  useEffect(() => {
    refresh();
  }, [isAuthenticated]);

  const selectAgent = useCallback(async (agentId: string) => {
    setSelectedAgentId(agentId);
    await api.agents.select(agentId);
  }, []);

  return { agents, selectedAgentId, selectAgent, loading, refresh };
}
