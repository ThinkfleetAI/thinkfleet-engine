import { useState, useEffect } from "react";
import type { useGateway } from "../hooks/useGateway";
import type { useAuth } from "../hooks/useAuth";
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
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyBypass, setProxyBypass] = useState("");
  const [proxySaved, setProxySaved] = useState(false);
  const [localAgentEnabled, setLocalAgentEnabled] = useState(false);

  useEffect(() => {
    api.settings.get("proxyUrl").then((v) => setProxyUrl((v as string) || ""));
    api.settings.get("proxyBypass").then((v) => setProxyBypass((v as string) || ""));
    api.settings.get("localAgentEnabled").then((v) => setLocalAgentEnabled(v === true));
  }, []);

  const handlePortSave = async () => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) return;
    await api.settings.set("gatewayPort", portNum);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Device Connection */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Device
        </div>
        {auth.isAuthenticated ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Connected <span style={{ color: "#64748b" }}>({auth.deviceId.slice(0, 8)}...)</span>
              </span>
            </div>
            <button
              onClick={() => auth.logout()}
              style={{ padding: "6px 12px", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer", alignSelf: "flex-start" }}
            >
              Disconnect Device
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#64748b" }}>Not connected. Complete onboarding to pair.</span>
        )}
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
      {/* Proxy */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Network Proxy
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: "#64748b", width: 52, flexShrink: 0 }}>Proxy</label>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="http://proxy.corp.com:8080"
              style={{ flex: 1, background: "#0f0f1a", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, border: "1px solid #2a2a4a", outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: "#64748b", width: 52, flexShrink: 0 }}>Bypass</label>
            <input
              type="text"
              value={proxyBypass}
              onChange={(e) => setProxyBypass(e.target.value)}
              placeholder="localhost,127.0.0.1,.internal"
              style={{ flex: 1, background: "#0f0f1a", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, border: "1px solid #2a2a4a", outline: "none" }}
            />
          </div>
          <button
            onClick={async () => {
              await api.settings.set("proxyUrl", proxyUrl);
              await api.settings.set("proxyBypass", proxyBypass);
              setProxySaved(true);
              setTimeout(() => setProxySaved(false), 2000);
            }}
            style={{ padding: "6px 12px", background: "rgba(124,58,237,0.1)", color: "#a78bfa", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "1px solid rgba(124,58,237,0.2)", cursor: "pointer", alignSelf: "flex-start" }}
          >
            {proxySaved ? "Saved" : "Save Proxy Settings"}
          </button>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
            Proxy will be used for gateway connections. Restart gateway after changing.
          </p>
        </div>
      </section>

      {/* Local Agent */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Local Agent
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={async () => {
              const next = !localAgentEnabled;
              setLocalAgentEnabled(next);
              await api.settings.set("localAgentEnabled", next);
            }}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              background: localAgentEnabled ? "#7c3aed" : "#2a2a4a",
              position: "relative",
              transition: "background 0.2s ease",
              flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute",
              top: 2,
              left: localAgentEnabled ? 20 : 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s ease",
            }} />
          </button>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            {localAgentEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
          Run a local ThinkFleet agent on this computer, managed via the central hub.
        </p>
      </section>
    </div>
  );
}
