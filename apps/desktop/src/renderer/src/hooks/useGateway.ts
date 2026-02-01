import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/ipc";

export interface GatewayState {
  status: string;
  port: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export function useGateway() {
  const [status, setStatus] = useState("stopped");
  const [port, setPort] = useState(18789);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamBuffer = useRef("");

  useEffect(() => {
    // Get initial status
    api.gateway.getStatus().then((state) => {
      setStatus(state.status);
      setPort(state.port);
    });

    // Listen for status changes
    const unsubStatus = api.gateway.onStatusChange((state) => {
      setStatus(state.status);
      setPort(state.port);
    });

    // Listen for gateway messages (JSON-RPC responses + events)
    const unsubMessage = api.gateway.onMessage((data) => {
      try {
        const msg = JSON.parse(data);
        handleGatewayMessage(msg);
      } catch {
        // ignore non-JSON
      }
    });

    return () => {
      unsubStatus();
      unsubMessage();
    };
  }, []);

  const handleGatewayMessage = useCallback((msg: any) => {
    // Handle chat.stream events
    if (msg.method === "chat.stream") {
      const { delta, done } = msg.params ?? {};

      if (delta) {
        setIsStreaming(true);
        streamBuffer.current += delta;

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === "streaming") {
            return [
              ...prev.slice(0, -1),
              { ...last, content: streamBuffer.current },
            ];
          }
          return [
            ...prev,
            {
              id: "streaming",
              role: "assistant",
              content: streamBuffer.current,
              timestamp: Date.now(),
            },
          ];
        });
      }

      if (done) {
        setIsStreaming(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === "streaming") {
            return [
              ...prev.slice(0, -1),
              { ...last, id: `msg-${Date.now()}` },
            ];
          }
          return prev;
        });
        streamBuffer.current = "";
      }
    }

    // Handle chat.send response (JSON-RPC result)
    if (msg.result && typeof msg.result === "object" && msg.result.content) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: msg.result.content,
          timestamp: Date.now(),
        },
      ]);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string, agentId = "default") => {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      await api.gateway.sendMessage(agentId, content);
    },
    [],
  );

  const start = useCallback(() => api.gateway.start(), []);
  const stop = useCallback(() => api.gateway.stop(), []);
  const restart = useCallback(() => api.gateway.restart(), []);

  return {
    status,
    port,
    messages,
    isStreaming,
    sendMessage,
    start,
    stop,
    restart,
    clearMessages: () => setMessages([]),
  };
}
