import { useState, useRef, useEffect } from "react";
import type { useGateway } from "../hooks/useGateway";

interface Props {
  gateway: ReturnType<typeof useGateway>;
}

export function ChatWindow({ gateway }: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gateway.messages]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || gateway.isStreaming) return;
    setInput("");
    await gateway.sendMessage(trimmed);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (gateway.status !== "running") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "0 32px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1e1e35", border: "1px solid #2a2a4a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          {gateway.status === "starting" ? (
            <span style={{ width: 20, height: 20, border: "2px solid rgba(124,58,237,0.3)", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite", display: "block" }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
          )}
        </div>
        <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 4, fontWeight: 500 }}>
          {gateway.status === "starting"
            ? "Starting gateway..."
            : gateway.status === "failed"
              ? "Gateway failed to start"
              : "Gateway is stopped"}
        </p>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          {gateway.status === "starting"
            ? "This usually takes a few seconds."
            : "The gateway needs to be running to chat."}
        </p>
        {gateway.status !== "starting" && (
          <button
            onClick={() => gateway.start()}
            style={{ padding: "10px 20px", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 500, borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(124,58,237,0.15)" }}
          >
            Start Gateway
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {gateway.messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", opacity: 0.6 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
              <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
            </svg>
            <p style={{ fontSize: 14, color: "#64748b" }}>Send a message to start chatting</p>
          </div>
        )}
        {gateway.messages.map((msg) => (
          <div
            key={msg.id}
            style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 16,
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                ...(msg.role === "user"
                  ? { background: "#7c3aed", color: "#fff", borderBottomRightRadius: 6 }
                  : { background: "#1e1e35", color: "#e2e8f0", border: "1px solid #2a2a4a", borderBottomLeftRadius: 6 }),
              }}
            >
              {msg.content}
              {msg.id === "streaming" && (
                <span style={{ display: "inline-block", width: 6, height: 16, background: "#a78bfa", marginLeft: 2, borderRadius: 2, animation: "blink 1s infinite" }} />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px 12px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#1e1e35", borderRadius: 12, border: "1px solid #2a2a4a", padding: 6 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your agent..."
            rows={1}
            style={{ flex: 1, background: "transparent", color: "#fff", fontSize: 14, resize: "none", border: "none", outline: "none", padding: "6px 8px", minHeight: 32, maxHeight: 96, fontFamily: "inherit" }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || gateway.isStreaming}
            style={{ padding: 8, background: "#7c3aed", color: "#fff", borderRadius: 8, border: "none", cursor: !input.trim() || gateway.isStreaming ? "not-allowed" : "pointer", opacity: !input.trim() || gateway.isStreaming ? 0.3 : 1, flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
