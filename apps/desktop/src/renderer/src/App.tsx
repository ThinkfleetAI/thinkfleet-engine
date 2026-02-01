import { useState, useEffect } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { Settings } from "./components/Settings";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { useGateway } from "./hooks/useGateway";
import { useAuth } from "./hooks/useAuth";
import { api } from "./lib/ipc";

type View = "chat" | "settings";

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "4px 12px",
  fontSize: 12,
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  transition: "all 0.15s ease",
  background: active ? "#7c3aed" : "transparent",
  color: active ? "#fff" : "#64748b",
  fontWeight: active ? 500 : 400,
  boxShadow: active ? "0 0 12px rgba(124,58,237,0.2)" : "none",
});

const statusDotColor = (status: string) => {
  if (status === "running") return "#34d399";
  if (status === "starting") return "#fbbf24";
  if (status === "failed") return "#f87171";
  return "#64748b";
};

export function App() {
  const [view, setView] = useState<View>("chat");
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const gateway = useGateway();
  const auth = useAuth();

  useEffect(() => {
    api.settings.get("onboardingComplete").then((val) => {
      setOnboardingComplete(val === true);
    });
  }, []);

  if (onboardingComplete === null) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f0f1a" }}>
        <span style={{ width: 20, height: 20, border: "2px solid rgba(124,58,237,0.3)", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite", display: "block" }} />
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <div style={{ height: "100vh", background: "#0f0f1a" }}>
        <div style={{ height: 32, background: "#161625", WebkitAppRegion: "drag" } as React.CSSProperties} />
        <div style={{ height: "calc(100vh - 32px)" }}>
          <OnboardingWizard auth={auth} onComplete={() => setOnboardingComplete(true)} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0f0f1a" }}>
      {/* Title bar */}
      <div
        style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "#161625", borderBottom: "1px solid #2a2a4a", userSelect: "none", WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 64 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#7c3aed">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, letterSpacing: "0.03em" }}>ThinkFleet</span>
        </div>
        <div style={{ display: "flex", gap: 2, background: "rgba(15,15,26,0.5)", borderRadius: 8, padding: 2, WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <button onClick={() => setView("chat")} style={tabStyle(view === "chat")}>Chat</button>
          <button onClick={() => setView("settings")} style={tabStyle(view === "settings")}>Settings</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {view === "chat" ? (
          <ChatWindow gateway={gateway} />
        ) : (
          <Settings auth={auth} gateway={gateway} />
        )}
      </div>

      {/* Status bar */}
      <div style={{ height: 24, display: "flex", alignItems: "center", padding: "0 12px", background: "#161625", borderTop: "1px solid #2a2a4a", fontSize: 10, color: "#64748b", gap: 16 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDotColor(gateway.status), animation: gateway.status === "starting" ? "pulse 2s infinite" : "none" }} />
          {gateway.status === "running" ? "Connected" : gateway.status === "starting" ? "Starting..." : gateway.status === "failed" ? "Failed" : "Offline"}
        </span>
        <span>{auth.agentMode === "saas" ? "SaaS" : "Standalone"}</span>
        <span>:{gateway.port}</span>
      </div>
    </div>
  );
}
