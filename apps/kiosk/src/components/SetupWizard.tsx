import { useState } from "react";

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState<"input" | "registering" | "waiting" | "error">("input");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (inviteCode.length < 4) return;

    setStatus("registering");
    setError("");

    try {
      const saasUrl = localStorage.getItem("thinkfleetbot-kiosk-saas-url") || "";
      const res = await fetch(`${saasUrl}/api/assistants/devices/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCode.toUpperCase(),
          deviceInfo: {
            hostname: location.hostname,
            platform: navigator.platform,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Registration failed (${res.status})`);
      }

      const data = await res.json();
      localStorage.setItem("thinkfleetbot-kiosk-device-id", data.deviceId);
      localStorage.setItem("thinkfleetbot-kiosk-pairing-token", data.pairingToken);

      setStatus("waiting");
      pollForApproval(data.deviceId, data.pairingToken, saasUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setStatus("error");
    }
  };

  const pollForApproval = async (deviceId: string, pairingToken: string, saasUrl: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${saasUrl}/api/assistants/devices/poll-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, pairingToken }),
        });

        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "ACTIVE") {
          if (data.authToken) {
            localStorage.setItem("thinkfleetbot-kiosk-auth-token", data.authToken);
          }
          if (data.config) {
            localStorage.setItem("thinkfleetbot-kiosk-config", JSON.stringify(data.config));
          }
          onComplete();
          return;
        }
      } catch {
        // keep polling
      }
      setTimeout(poll, 5000);
    };
    poll();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>ThinkFleetBot Setup</h1>

        {status === "input" || status === "error" ? (
          <>
            <p style={styles.subtitle}>Enter the invite code from your ThinkFleetBot dashboard</p>
            <input
              style={styles.input}
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="INVITE CODE"
              maxLength={8}
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} onClick={handleSubmit}>
              Register Device
            </button>

            <div style={styles.divider} />
            <p style={styles.hint}>SaaS URL:</p>
            <input
              style={{ ...styles.input, fontSize: 14 }}
              type="url"
              defaultValue={localStorage.getItem("thinkfleetbot-kiosk-saas-url") || ""}
              onChange={(e) => localStorage.setItem("thinkfleetbot-kiosk-saas-url", e.target.value)}
              placeholder="https://your-thinkfleetbot.example.com"
            />
          </>
        ) : status === "registering" ? (
          <p style={styles.subtitle}>Registering device...</p>
        ) : (
          <>
            <div style={styles.waitingIcon}>⏳</div>
            <p style={styles.subtitle}>Waiting for admin approval</p>
            <p style={styles.hint}>Ask an admin to approve this device in the ThinkFleetBot dashboard</p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100vw",
    height: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    background: "rgba(30,41,59,0.8)",
    backdropFilter: "blur(20px)",
    borderRadius: 24,
    padding: 48,
    maxWidth: 400,
    width: "90%",
    textAlign: "center",
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    marginBottom: 24,
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 8,
    background: "rgba(255,255,255,0.1)",
    border: "2px solid rgba(255,255,255,0.2)",
    borderRadius: 12,
    color: "white",
    outline: "none",
    marginBottom: 16,
  },
  button: {
    width: "100%",
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 600,
    background: "linear-gradient(135deg, #4ade80, #10b981)",
    color: "white",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
  },
  error: {
    color: "#f87171",
    fontSize: 14,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.1)",
    margin: "24px 0",
  },
  hint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    marginBottom: 8,
  },
  waitingIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
};
