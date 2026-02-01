import { useState } from "react";
import type { useGateway } from "../hooks/useGateway";
import type { useAuth } from "../hooks/useAuth";
import { AgentModeSwitch } from "./AgentModeSwitch";
import { api } from "../lib/ipc";

interface Props {
  auth: ReturnType<typeof useAuth>;
  gateway: ReturnType<typeof useGateway>;
}

const sectionStyle: React.CSSProperties = {
  background: "#1e1e35",
  borderRadius: 12,
  border: "1px solid #2a2a4a",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const sectionTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  fontWeight: 500,
  color: "#fff",
};

const btnBase: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 12,
  border: "1px solid #2a2a4a",
  background: "#0f0f1a",
  color: "#94a3b8",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

export function Settings({ auth, gateway }: Props) {
  const [port, setPort] = useState(String(gateway.port));
  const [saved, setSaved] = useState(false);

  const handlePortSave = async () => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) return;
    await api.settings.set("gatewayPort", portNum);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Agent Mode */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
          </svg>
          Agent Mode
        </div>
        <AgentModeSwitch auth={auth} />
      </section>

      {/* Gateway */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          Gateway
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#64748b", width: 36, flexShrink: 0 }}>Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            style={{ background: "#0f0f1a", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, width: 96, border: "1px solid #2a2a4a", outline: "none" }}
          />
          <button
            onClick={handlePortSave}
            style={{ padding: "6px 12px", background: "rgba(124,58,237,0.1)", color: "#a78bfa", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "1px solid rgba(124,58,237,0.2)", cursor: "pointer" }}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => gateway.restart()} style={btnBase}>
            Restart Gateway
          </button>
          <button
            onClick={() => gateway.status === "running" ? gateway.stop() : gateway.start()}
            style={{
              ...btnBase,
              background: gateway.status === "running" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
              color: gateway.status === "running" ? "#f87171" : "#34d399",
              border: gateway.status === "running" ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(16,185,129,0.2)",
            }}
          >
            {gateway.status === "running" ? "Stop" : "Start"} Gateway
          </button>
        </div>
      </section>

      {/* SaaS Connection */}
      {auth.agentMode === "saas" && (
        <section style={sectionStyle}>
          <div style={sectionTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
            </svg>
            SaaS Connection
          </div>
          {auth.isAuthenticated ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  Connected to <span style={{ color: "#fff", fontWeight: 500 }}>{auth.saasUrl}</span>
                </span>
              </div>
              <button
                onClick={() => auth.logout()}
                style={{ padding: "6px 12px", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", alignSelf: "flex-start" }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <SaaSLoginForm onLogin={auth.login} />
          )}
        </section>
      )}
    </div>
  );
}

function SaaSLoginForm({ onLogin }: { onLogin: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onLogin(url.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://your-team.thinkfleet.ai"
        style={{ width: "100%", background: "#0f0f1a", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 14, border: "1px solid #2a2a4a", outline: "none" }}
      />
      {error && (
        <p style={{ fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || !url.trim()}
        style={{ padding: "8px 16px", background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "none", cursor: loading || !url.trim() ? "not-allowed" : "pointer", opacity: loading || !url.trim() ? 0.4 : 1, alignSelf: "flex-start" }}
      >
        {loading ? "Connecting..." : "Connect"}
      </button>
    </form>
  );
}
