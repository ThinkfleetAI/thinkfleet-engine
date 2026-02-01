import type { useAuth } from "../hooks/useAuth";

interface Props {
  auth: ReturnType<typeof useAuth>;
}

export function AgentModeSwitch({ auth }: Props) {
  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    border: active ? "1px solid rgba(124,58,237,0.3)" : "1px solid #2a2a4a",
    background: active ? "rgba(124,58,237,0.15)" : "#1e1e35",
    color: active ? "#a78bfa" : "#94a3b8",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.15s ease",
    boxShadow: active ? "0 0 20px rgba(124,58,237,0.15)" : "none",
  });

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => auth.switchMode("standalone")} style={btnStyle(auth.agentMode === "standalone")}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <path d="m8 21 4-4 4 4" />
          </svg>
          <span style={{ fontWeight: 600 }}>Standalone</span>
        </div>
        <div style={{ fontSize: 10, opacity: 0.6, marginLeft: 22 }}>Local config + API keys</div>
      </button>
      <button onClick={() => auth.switchMode("saas")} style={btnStyle(auth.agentMode === "saas")}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="m8 17 4-4 4 4" />
          </svg>
          <span style={{ fontWeight: 600 }}>SaaS Connected</span>
        </div>
        <div style={{ fontSize: 10, opacity: 0.6, marginLeft: 22 }}>Credentials from hub</div>
      </button>
    </div>
  );
}
