import { useState, useEffect } from "react";
import type { AgentMood } from "../characters";

interface StatusBarProps {
  connected: boolean;
  isSpeaking: boolean;
  mood: AgentMood;
}

export function StatusBar({ connected, isSpeaking, mood }: StatusBarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <div
          style={{
            ...styles.dot,
            background: connected ? "#4ade80" : "#ef4444",
          }}
        />
        <span style={styles.label}>{connected ? "Connected" : "Disconnected"}</span>
      </div>

      <div style={styles.center}>
        <span style={styles.time}>
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div style={styles.right}>
        {isSpeaking && <span style={styles.micIcon}>🔊</span>}
        <span style={styles.moodBadge}>{mood}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    zIndex: 10,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  center: {},
  right: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  time: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
  },
  micIcon: {
    fontSize: 16,
  },
  moodBadge: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
};
