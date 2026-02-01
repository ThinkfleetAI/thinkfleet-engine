import { useState } from "react";
import type { useAuth } from "../hooks/useAuth";
import { api } from "../lib/ipc";

interface Props {
  auth: ReturnType<typeof useAuth>;
  onComplete: () => void;
}

type Step = "welcome" | "saas-login" | "done";

export function OnboardingWizard({ auth, onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [saasUrl, setSaasUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSaasLogin = async () => {
    if (!saasUrl.trim()) return;
    setLoading(true);
    setError("");
    try {
      await auth.login(saasUrl.trim());
      await api.settings.set("onboardingComplete", true);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>You're all set!</h2>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 32, textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
          ThinkFleet is configured and your gateway will start automatically.
        </p>
        <button
          onClick={onComplete}
          style={{ padding: "10px 24px", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 500, borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(124,58,237,0.15)" }}
        >
          Open ThinkFleet &rarr;
        </button>
      </div>
    );
  }

  if (step === "saas-login") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 4 }}>Connect to ThinkFleet</h2>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24, textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
          Enter your ThinkFleet instance URL to sync credentials and agents.
        </p>
        <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="url"
            value={saasUrl}
            onChange={(e) => setSaasUrl(e.target.value)}
            placeholder="https://your-team.thinkfleet.ai"
            style={{ width: "100%", background: "#1e1e35", color: "#fff", borderRadius: 8, padding: "10px 14px", fontSize: 14, border: "1px solid #2a2a4a", outline: "none", boxSizing: "border-box" }}
            onKeyDown={(e) => e.key === "Enter" && handleSaasLogin()}
            autoFocus
          />
          {error && (
            <p style={{ fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
              {error}
            </p>
          )}
          <button
            onClick={handleSaasLogin}
            disabled={loading || !saasUrl.trim()}
            style={{ width: "100%", padding: "10px 16px", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 500, borderRadius: 8, border: "none", cursor: loading || !saasUrl.trim() ? "not-allowed" : "pointer", opacity: loading || !saasUrl.trim() ? 0.4 : 1 }}
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    );
  }

  // Welcome step
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px" }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #7c3aed, #5b21b6)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 0 30px rgba(124,58,237,0.25)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>ThinkFleet</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 32, maxWidth: 260, textAlign: "center", lineHeight: 1.6 }}>
        Your AI agent fleet, running locally. Chat, automate, and connect&nbsp;to&nbsp;your&nbsp;channels.
      </p>
      <button
        onClick={() => setStep("saas-login")}
        style={{ padding: "10px 24px", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 500, borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(124,58,237,0.15)" }}
      >
        Get Started &rarr;
      </button>
    </div>
  );
}
