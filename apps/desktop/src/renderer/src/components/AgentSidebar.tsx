import type { AgentInfo } from "../../../preload/index";

interface Props {
  agents: AgentInfo[];
  selectedAgentId: string;
  onSelect: (agentId: string) => void;
  loading: boolean;
  localAgentEnabled?: boolean;
}

const statusColor = (status: string) => {
  if (status === "RUNNING") return "#34d399";
  if (status === "PENDING") return "#fbbf24";
  if (status === "ERROR") return "#f87171";
  return "#64748b";
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function AgentSidebar({ agents, selectedAgentId, onSelect, loading, localAgentEnabled }: Props) {
  if (loading && agents.length === 0) {
    return (
      <div style={{ width: 56, background: "#12121f", borderRight: "1px solid #2a2a4a", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8 }}>
        <span style={{ width: 14, height: 14, border: "2px solid rgba(124,58,237,0.3)", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite", display: "block" }} />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div style={{ width: 56, background: "#12121f", borderRight: "1px solid #2a2a4a", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12 }}>
        <span style={{ fontSize: 9, color: "#64748b", textAlign: "center", padding: "0 4px" }}>No agents</span>
      </div>
    );
  }

  return (
    <div style={{ width: 56, background: "#12121f", borderRight: "1px solid #2a2a4a", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, gap: 6, overflowY: "auto" }}>
      {localAgentEnabled && (
        <button
          onClick={() => onSelect("__local__")}
          title="Local Agent"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: selectedAgentId === "__local__" ? "2px solid #34d399" : "2px solid transparent",
            background: selectedAgentId === "__local__" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
            color: selectedAgentId === "__local__" ? "#34d399" : "#94a3b8",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
        >
          {/* Computer icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>
      )}
      {localAgentEnabled && agents.length > 0 && (
        <div style={{ width: 24, height: 1, background: "#2a2a4a", flexShrink: 0 }} />
      )}
      {agents.map((agent) => {
        const isActive = agent.agentId === selectedAgentId;
        return (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.agentId)}
            title={agent.name}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: isActive ? "2px solid #7c3aed" : "2px solid transparent",
              background: isActive ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
              color: isActive ? "#c4b5fd" : "#94a3b8",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            {getInitials(agent.name)}
            {/* Status dot */}
            <span
              style={{
                position: "absolute",
                bottom: 1,
                right: 1,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusColor(agent.status),
                border: "2px solid #12121f",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
