import { useState, useEffect, useRef } from "react";
import type { useAuth } from "../hooks/useAuth";
import { api } from "../lib/ipc";

interface Props {
  auth: ReturnType<typeof useAuth>;
  onComplete: () => void;
}

type Step = "welcome" | "enter-code" | "waiting-approval" | "done";

export function OnboardingWizard({ auth, onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSubmitCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setLoading(true);
    setError("");
    try {
      const result = await auth.registerDevice(trimmed);
      setStep("waiting-approval");
      startPolling(result.deviceId, result.pairingToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (deviceId: string, pairingToken: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const result = await auth.pollStatus(deviceId, pairingToken);
        if (result.status === "ACTIVE") {
          if (pollRef.current) clearInterval(pollRef.current);
          await api.settings.set("onboardingComplete", true);
          setStep("done");
        }
      } catch {
        // Silently retry
      }
    }, 5000);
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
          Your device is connected. The gateway will start automatically.
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

  if (step === "waiting-approval") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <span style={{ width: 20, height: 20, border: "2px solid rgba(124,58,237,0.3)", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite", display: "block" }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 4 }}>Waiting for Approval</h2>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          Your device has been registered. An admin needs to approve it from the ThinkFleet dashboard.
        </p>
        <p style={{ fontSize: 11, color: "#64748b", marginBottom: 24 }}>
          Checking every few seconds...
        </p>
        <button
          onClick={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            setStep("enter-code");
            setCode("");
          }}
          style={{ padding: "6px 16px", background: "transparent", color: "#94a3b8", fontSize: 13, border: "none", cursor: "pointer" }}
        >
          &larr; Use a different code
        </button>
      </div>
    );
  }

  if (step === "enter-code") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginBottom: 4 }}>Enter Device Code</h2>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          Enter the 6-character code from your ThinkFleet dashboard to pair this device.
        </p>
        <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="ABC123"
            maxLength={6}
            style={{
              width: "100%",
              background: "#1e1e35",
              color: "#fff",
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textAlign: "center",
              border: "1px solid #2a2a4a",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "monospace",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitCode()}
            autoFocus
          />
          {error && (
            <p style={{ fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 6, margin: 0, justifyContent: "center" }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
              {error}
            </p>
          )}
          <button
            onClick={handleSubmitCode}
            disabled={loading || code.trim().length < 4}
            style={{ width: "100%", padding: "10px 16px", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 500, borderRadius: 8, border: "none", cursor: loading || code.trim().length < 4 ? "not-allowed" : "pointer", opacity: loading || code.trim().length < 4 ? 0.4 : 1 }}
          >
            {loading ? "Registering..." : "Connect Device"}
          </button>
        </div>
      </div>
    );
  }

  // Welcome step
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 32px" }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, rgba(56,117,200,0.15), rgba(56,117,200,0.05))", border: "1px solid rgba(56,117,200,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 0 30px rgba(56,117,200,0.15)" }}>
        <svg width="36" height="36" viewBox="0 0 82 82" fill="#3875c8">
          <path d="M73.91,36.12c.65-2.05,2.03-7.74-.6-12.79-1.85-3.55-5.24-6-10.08-7.29-1.47-2.59-6.93-10.51-18.02-8.72-4.06.66-7.1,3.67-7.58,7.36h-6.04v-3.5c2.31-.74,3.98-2.9,3.98-5.45,0-3.16-2.57-5.72-5.72-5.72s-5.72,2.57-5.72,5.72c0,2.55,1.67,4.71,3.98,5.45v3.5h-3.86c-4.88,0-8.85,3.97-8.85,8.85v6.57h-4.21c-.74-2.31-2.9-3.98-5.45-3.98-3.16,0-5.72,2.57-5.72,5.72s2.57,5.72,5.72,5.72c2.55,0,4.71-1.67,5.45-3.98h4.21v14h-4.21c-.74-2.31-2.9-3.98-5.45-3.98-3.16,0-5.72,2.57-5.72,5.72s2.57,5.72,5.72,5.72c2.55,0,4.71-1.67,5.45-3.98h4.21v7.19c0,4.88,3.97,8.85,8.85,8.85h3.86v3.75c-2.31.74-3.98,2.9-3.98,5.45,0,3.16,2.57,5.72,5.72,5.72s5.72-2.57,5.72-5.72c0-2.55-1.67-4.71-3.98-5.45v-3.75h6.24c.55,1.93,1.9,3.62,3.79,4.66,1.36.75,3.29,1.51,5.54,1.51,2.69,0,5.84-1.09,8.99-4.61,1.69-.04,5.34-.44,8.11-2.95,1.94-1.76,3.06-4.17,3.33-7.18,1.98-.96,6.12-3.46,7.95-8.22,1.6-4.15,1.05-8.93-1.62-14.21ZM29.84,3.49c1.23,0,2.24,1,2.24,2.24s-1,2.24-2.24,2.24-2.24-1-2.24-2.24,1-2.24,2.24-2.24ZM5.72,34.07c-1.23,0-2.24-1-2.24-2.24s1-2.24,2.24-2.24,2.24,1,2.24,2.24-1,2.24-2.24,2.24ZM5.72,51.56c-1.23,0-2.24-1-2.24-2.24s1-2.24,2.24-2.24,2.24,1,2.24,2.24-1,2.24-2.24,2.24ZM29.84,78.55c-1.23,0-2.24-1-2.24-2.24s1-2.24,2.24-2.24,2.24,1,2.24,2.24-1,2.24-2.24,2.24ZM37.54,55.82h-9.67c-.55,0-1-.45-1-1v-27.86c0-.55.45-1,1-1h9.67v29.87ZM18.86,58.26V23.52c0-2.96,2.41-5.36,5.36-5.36h13.32v4.31h-9.67c-2.48,0-4.49,2.01-4.49,4.49v27.86c0,2.48,2.01,4.49,4.49,4.49h9.67v4.31h-13.32c-2.96,0-5.36-2.41-5.36-5.36ZM72.29,49.04c-1.77,4.66-6.73,6.59-6.96,6.68-.27.09-5.04,1.57-10.21,1.24.56-3.12-.09-5.68-.14-5.87-.24-.93-1.19-1.49-2.13-1.24-.93.24-1.49,1.2-1.24,2.13.02.06,1.56,6.2-3.26,9.92-.76.59-.91,1.68-.32,2.45.34.45.86.68,1.38.68.37,0,.75-.12,1.06-.36,1.68-1.29,2.8-2.78,3.54-4.28.02,0,.04.01.06.01.88.09,1.75.12,2.6.12,2.82,0,5.38-.41,7.17-.8-.35,1.41-.99,2.56-1.93,3.42-2.52,2.3-6.41,2.06-6.45,2.06l-.9-.07-.58.7c-3.32,4.02-6.93,5-10.71,2.91-1.42-.78-2.26-2.11-2.26-3.57v-11c.41-.91,2.67-5,10.58-6.69.94-.2,1.54-1.13,1.34-2.07-.2-.94-1.13-1.54-2.07-1.34-4.75,1.02-7.85,2.83-9.86,4.59v-8.35c.64-.99,2.73-3.79,6.94-5.94,1.1.49,3.63,2.02,4.92,5.99.24.74.92,1.21,1.66,1.21.18,0,.36-.03.54-.09.92-.3,1.42-1.28,1.12-2.2-1.03-3.18-2.73-5.21-4.28-6.49,2.93-.87,6.54-1.36,10.93-1.07.94.06,1.79-.66,1.85-1.62.06-.96-.66-1.79-1.62-1.86-11.58-.77-18.46,3.39-22.07,6.76v-7.52c.64-.78,2.3-2.57,4.86-3.55.9-.35,1.35-1.35,1-2.25-.35-.9-1.36-1.35-2.25-1-1.43.55-2.63,1.28-3.61,2.02v-6.96c0-2.43,1.99-4.51,4.73-4.96.91-.15,1.77-.21,2.59-.21,5.53,0,8.9,3.08,10.64,5.35-1.57.22-3.44.75-4.95,1.95-1.37-1.44-3.32-2.91-6.14-4.06-.89-.36-1.91.07-2.27.96-.36.89.07,1.91.96,2.27,6.02,2.44,7,6.52,7.05,6.73.17.82.89,1.4,1.71,1.4.11,0,.22-.01.33-.03.94-.18,1.56-1.1,1.38-2.04-.02-.1-.23-1.08-.96-2.42,1.64-1.41,4.54-1.48,5.65-1.39,4.16,1,7,2.9,8.45,5.66,2.48,4.73.21,10.64.19,10.69l-.03.08c-.19.47-2.36,5.54-9.42,6.64-.95.15-1.6,1.04-1.45,1.99.13.86.88,1.48,1.72,1.48.09,0,.18,0,.27-.02,5.39-.84,8.56-3.57,10.32-5.8,1.3,3.41,1.48,6.46.48,9.07Z" />
        </svg>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>ThinkFleet</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 32, maxWidth: 260, textAlign: "center", lineHeight: 1.6 }}>
        Your AI agent fleet, running locally. Chat, automate, and connect&nbsp;to&nbsp;your&nbsp;channels.
      </p>
      <button
        onClick={() => setStep("enter-code")}
        style={{ padding: "10px 24px", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 500, borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(124,58,237,0.15)" }}
      >
        Get Started &rarr;
      </button>
    </div>
  );
}
