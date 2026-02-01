import { useState, useEffect, useRef, useCallback } from "react";
import { getCharacter, type AgentMood, type FaceProps } from "../characters";

interface AvatarProps {
  mood: AgentMood;
  isSpeaking: boolean;
  characterKey?: string;
}

const MOOD_GRADIENTS: Record<AgentMood, [string, string]> = {
  idle: ["#4ade80", "#10b981"],
  thinking: ["#facc15", "#eab308"],
  working: ["#60a5fa", "#3b82f6"],
  focused: ["#818cf8", "#6366f1"],
  excited: ["#f472b6", "#ec4899"],
  confused: ["#fbbf24", "#f59e0b"],
  error: ["#f87171", "#ef4444"],
  sleeping: ["#6b7280", "#4b5563"],
  offline: ["#374151", "#1f2937"],
};

export function Avatar({ mood, isSpeaking, characterKey }: AvatarProps) {
  const character = getCharacter(characterKey);
  const [blinkPhase, setBlinkPhase] = useState(false);
  const [lookX, setLookX] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);
  const animRef = useRef<number>(0);

  // Blink loop
  useEffect(() => {
    const blink = () => {
      setBlinkPhase(true);
      setTimeout(() => setBlinkPhase(false), 150);
    };
    const interval = setInterval(blink, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  // Subtle idle look around
  useEffect(() => {
    const drift = () => {
      setLookX(Math.sin(Date.now() / 4000) * 0.3);
      animRef.current = requestAnimationFrame(drift);
    };
    animRef.current = requestAnimationFrame(drift);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Pulse when speaking
  useEffect(() => {
    if (!isSpeaking) {
      setPulseScale(1);
      return;
    }
    let frame: number;
    const pulse = () => {
      setPulseScale(1 + Math.sin(Date.now() / 200) * 0.03);
      frame = requestAnimationFrame(pulse);
    };
    frame = requestAnimationFrame(pulse);
    return () => cancelAnimationFrame(frame);
  }, [isSpeaking]);

  const [from, to] = MOOD_GRADIENTS[mood] ?? MOOD_GRADIENTS.idle;
  const avatarSize = Math.min(window.innerWidth, window.innerHeight) * 0.5;

  const faceProps: FaceProps = {
    mood,
    size: avatarSize * 0.6,
    blinkPhase,
    lookX,
  };

  return (
    <div style={{ position: "relative", transform: `scale(${pulseScale})`, transition: "transform 0.1s ease" }}>
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: avatarSize * 1.5,
          height: avatarSize * 1.5,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${from}33 0%, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Main circle */}
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${from}, ${to})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          boxShadow: `0 0 60px ${from}66, 0 0 120px ${from}33`,
          transition: "background 0.5s ease, box-shadow 0.5s ease",
        }}
      >
        {character.render(faceProps)}
      </div>

      {/* Speaking ring */}
      {isSpeaking && (
        <div
          style={{
            position: "absolute",
            top: -8,
            left: -8,
            right: -8,
            bottom: -8,
            borderRadius: "50%",
            border: `3px solid ${from}88`,
            animation: "speakPulse 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      <style>{`
        @keyframes speakPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
