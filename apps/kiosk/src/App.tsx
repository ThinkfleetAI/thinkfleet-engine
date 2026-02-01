import { useState, useEffect, useCallback, useRef } from "react";
import { Avatar } from "./components/Avatar";
import { StatusBar } from "./components/StatusBar";
import { ContentOverlay } from "./components/ContentOverlay";
import { SetupWizard } from "./components/SetupWizard";
import { useLocalAudio, type KioskMessage } from "./hooks/useLocalAudio";
import type { AgentMood } from "./characters";

interface ContentPayload {
  contentType: "url" | "receipt";
  payload: Record<string, unknown>;
}

export function App() {
  const [configured, setConfigured] = useState(() => {
    return !!localStorage.getItem("clawdbot-kiosk-configured");
  });

  const [mood, setMood] = useState<AgentMood>("idle");
  const [transcript, setTranscript] = useState("");
  const [agentText, setAgentText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [content, setContent] = useState<ContentPayload | null>(null);
  const agentTextTimeout = useRef<ReturnType<typeof setTimeout>>();

  const onMessage = useCallback((msg: KioskMessage) => {
    switch (msg.type) {
      case "agent.mood":
        setMood(msg.mood as AgentMood);
        break;
      case "transcript.partial":
        setTranscript(msg.text ?? "");
        break;
      case "transcript.final":
        setTranscript(msg.text ?? "");
        setTimeout(() => setTranscript(""), 3000);
        break;
      case "agent.speaking":
        setAgentText(msg.text ?? "");
        clearTimeout(agentTextTimeout.current);
        agentTextTimeout.current = setTimeout(() => setAgentText(""), 8000);
        break;
      case "agent.content":
        setContent({
          contentType: (msg as any).contentType,
          payload: (msg as any).payload,
        });
        break;
      case "tts.start":
        setIsSpeaking(true);
        break;
      case "tts.end":
        setIsSpeaking(false);
        break;
    }
  }, []);

  const { connected, start, stop } = useLocalAudio({ onMessage });

  // Auto-start audio session when configured
  useEffect(() => {
    if (configured && connected) {
      start();
    }
    return () => stop();
  }, [configured, connected, start, stop]);

  if (!configured) {
    return (
      <SetupWizard
        onComplete={() => {
          localStorage.setItem("clawdbot-kiosk-configured", "true");
          setConfigured(true);
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <StatusBar connected={connected} isSpeaking={isSpeaking} mood={mood} />

      <div style={styles.avatarArea}>
        <Avatar mood={mood} isSpeaking={isSpeaking} />
      </div>

      {/* Transcript overlay */}
      {transcript && (
        <div style={styles.transcript}>
          <div style={styles.transcriptLabel}>You said:</div>
          <div style={styles.transcriptText}>{transcript}</div>
        </div>
      )}

      {/* Agent response overlay */}
      {agentText && (
        <div style={styles.agentText}>
          <div style={styles.agentTextContent}>{agentText}</div>
        </div>
      )}

      {/* Content overlay (iframe/receipt) */}
      {content && (
        <ContentOverlay
          content={content}
          onDismiss={() => setContent(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100vw",
    height: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  avatarArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  transcript: {
    position: "absolute",
    bottom: 120,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(255,255,255,0.1)",
    backdropFilter: "blur(10px)",
    borderRadius: 16,
    padding: "12px 24px",
    maxWidth: "80%",
    textAlign: "center",
  },
  transcriptLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginBottom: 4,
  },
  transcriptText: {
    color: "white",
    fontSize: 18,
  },
  agentText: {
    position: "absolute",
    bottom: 40,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(34,197,94,0.15)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: 16,
    padding: "12px 24px",
    maxWidth: "80%",
    textAlign: "center",
  },
  agentTextContent: {
    color: "white",
    fontSize: 18,
  },
};
