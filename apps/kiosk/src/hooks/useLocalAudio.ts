import { useCallback, useEffect, useRef, useState } from "react";
import { createMicCapture } from "../lib/mic-worklet";
import { createAudioPlayer } from "../lib/audio-player";

export interface KioskMessage {
  type: string;
  text?: string;
  mood?: string;
  contentType?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

interface UseLocalAudioOpts {
  gatewayUrl?: string;
  onMessage: (msg: KioskMessage) => void;
}

export function useLocalAudio({ gatewayUrl, onMessage }: UseLocalAudioOpts) {
  const wsUrl = gatewayUrl || `ws://${location.hostname}:18789/ws/local-audio`;
  const wsRef = useRef<WebSocket | null>(null);
  const micRef = useRef<ReturnType<typeof createMicCapture> | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Connect WebSocket
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let dead = false;

    const connect = () => {
      if (dead) return;
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Init audio player on first connect
        if (!playerRef.current) {
          playerRef.current = createAudioPlayer();
        }
      };

      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          // Binary = TTS audio PCM 16kHz 16-bit mono
          playerRef.current?.enqueue(new Int16Array(ev.data));
        } else {
          try {
            const msg = JSON.parse(ev.data as string) as KioskMessage;
            // Handle TTS state for audio player
            if (msg.type === "tts.start") {
              playerRef.current?.clear(); // barge-in: clear old audio
            }
            onMessageRef.current(msg);
          } catch {
            // ignore malformed
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      dead = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [wsUrl]);

  const start = useCallback(async () => {
    if (micRef.current) return;
    const mic = await createMicCapture((pcmChunk) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(pcmChunk.buffer);
      }
    });
    micRef.current = mic;

    // Tell gateway we're starting
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "session.start" }));
    }
  }, []);

  const stop = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "session.end" }));
    }

    playerRef.current?.clear();
  }, []);

  return { connected, start, stop };
}
