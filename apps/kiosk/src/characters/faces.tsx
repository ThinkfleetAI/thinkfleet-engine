import type { FaceProps } from "./index";

/* ─── Helpers ─────────────────────────────────────────── */

function Eyes({
  mood,
  blinkPhase,
  lookX,
  lx = 37,
  rx = 63,
  cy = 42,
  baseRx = 8,
  baseRy = 8,
  pupilR = 3.5,
  fill = "white",
  pupilFill = "#1f2937",
}: FaceProps & {
  lx?: number;
  rx?: number;
  cy?: number;
  baseRx?: number;
  baseRy?: number;
  pupilR?: number;
  fill?: string;
  pupilFill?: string;
}) {
  const isAsleep = mood === "sleeping";
  const isOffline = mood === "offline";
  const blink = blinkPhase && !isAsleep && !isOffline;

  const eyeRx = mood === "excited" ? baseRx + 2 : baseRx;
  const eyeRy = mood === "excited" ? baseRy + 2 : mood === "focused" ? baseRy - 3 : baseRy;
  const leftEyeRy = blink ? 1 : mood === "confused" ? baseRy + 1 : eyeRy;
  const rightEyeRy = blink ? 1 : mood === "confused" ? baseRy - 3 : eyeRy;
  const pR = mood === "excited" ? pupilR + 1 : pupilR;
  const dx = lookX * 3;

  return (
    <>
      <ellipse cx={lx + dx * 0.5} cy={cy} rx={eyeRx} ry={isAsleep ? 1 : leftEyeRy} fill={fill} style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={lx + dx} cy={cy} r={pR} fill={pupilFill} style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx={rx + dx * 0.5} cy={cy} rx={eyeRx} ry={isAsleep ? 1 : rightEyeRy} fill={fill} style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={rx + dx} cy={cy} r={pR} fill={pupilFill} style={{ transition: "all 0.2s ease" }} />}
    </>
  );
}

function SleepingZs() {
  return (
    <>
      <text x="68" y="28" fontSize="10" fontWeight="bold" fill="white" opacity="0.7">
        z
        <animate attributeName="y" values="28;20;28" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
      </text>
      <text x="76" y="20" fontSize="7" fontWeight="bold" fill="white" opacity="0.5">
        z
        <animate attributeName="y" values="20;12;20" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2.5s" repeatCount="indefinite" />
      </text>
    </>
  );
}

function Sparkles() {
  return (
    <>
      <text x="18" y="22" fontSize="10" fill="white" opacity="0.8">✦</text>
      <text x="76" y="18" fontSize="8" fill="white" opacity="0.6">✦</text>
    </>
  );
}

function Wrapper({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {children}
    </svg>
  );
}

function getMouthPath(mood: FaceProps["mood"]): React.JSX.Element | null {
  switch (mood) {
    case "idle": return <path d="M 38 58 Q 50 70 62 58" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />;
    case "thinking": return <ellipse cx="50" cy="60" rx="4" ry="5" fill="white" opacity="0.9" />;
    case "working": return <path d="M 38 56 Q 50 68 62 56" fill="white" opacity="0.8" stroke="white" strokeWidth="2" />;
    case "focused": return <line x1="40" y1="60" x2="60" y2="60" stroke="white" strokeWidth="2.5" strokeLinecap="round" />;
    case "excited": return <path d="M 34 55 Q 50 75 66 55" fill="white" opacity="0.9" stroke="white" strokeWidth="2" />;
    case "confused": return <path d="M 38 60 Q 43 55 48 60 Q 53 65 58 60 Q 63 55 65 58" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />;
    case "error": return <path d="M 38 64 Q 50 54 62 64" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />;
    case "sleeping": return <path d="M 40 60 Q 50 63 60 60" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />;
    case "offline": return <line x1="40" y1="60" x2="60" y2="60" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />;
    default: return null;
  }
}

function getEyebrows(mood: FaceProps["mood"]): React.JSX.Element | null {
  switch (mood) {
    case "excited": return (<><path d="M 30 28 Q 37 22 44 28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" /><path d="M 56 28 Q 63 22 70 28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" /></>);
    case "focused": return (<><line x1="30" y1="30" x2="44" y2="28" stroke="white" strokeWidth="2" strokeLinecap="round" /><line x1="70" y1="30" x2="56" y2="28" stroke="white" strokeWidth="2" strokeLinecap="round" /></>);
    case "confused": return (<><path d="M 30 26 Q 37 20 44 26" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" /><line x1="56" y1="30" x2="70" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" /></>);
    case "error": return (<><line x1="30" y1="28" x2="44" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" /><line x1="70" y1="28" x2="56" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" /></>);
    default: return null;
  }
}

function getExtras(mood: FaceProps["mood"]): React.JSX.Element | null {
  switch (mood) {
    case "excited": return <Sparkles />;
    case "error": return <ellipse cx="76" cy="30" rx="3" ry="5" fill="white" opacity="0.6"><animate attributeName="cy" values="28;34;28" dur="1.5s" repeatCount="indefinite" /></ellipse>;
    case "sleeping": return <SleepingZs />;
    default: return null;
  }
}

/* ─── 1. Default ─────────────────────────────────────── */
export function DefaultFace(props: FaceProps) {
  return (<Wrapper size={props.size}><Eyes {...props} />{getEyebrows(props.mood)}{getMouthPath(props.mood)}{getExtras(props.mood)}</Wrapper>);
}

/* ─── 2. Robot ───────────────────────────────────────── */
export function RobotFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;
  const eyeH = blink || isAsleep ? 1 : mood === "focused" ? 8 : 12;

  return (
    <Wrapper size={size}>
      <line x1="50" y1="5" x2="50" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="3" r="4" fill="white" opacity={mood === "working" ? 1 : 0.85}>
        {mood === "working" && <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />}
      </circle>
      <rect x={29 + dx * 0.5} y={36} width="16" height={eyeH} rx="1" fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <rect x={34 + dx} y={38} width="6" height={Math.min(eyeH - 4, 6)} rx="1" fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <rect x={55 + dx * 0.5} y={36} width="16" height={eyeH} rx="1" fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <rect x={60 + dx} y={38} width="6" height={Math.min(eyeH - 4, 6)} rx="1" fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      {mood === "idle" || mood === "working" || mood === "excited" ? (
        <g>{[36, 42, 48, 54, 60].map((x) => (<rect key={x} x={x} y="58" width="4" height="6" rx="0.5" fill="white" opacity={mood === "excited" ? 0.95 : 0.8} />))}</g>
      ) : mood === "error" ? (
        <line x1="36" y1="62" x2="64" y2="62" stroke="white" strokeWidth="3" strokeLinecap="round" />
      ) : mood === "confused" ? (
        <path d="M 38 60 L 44 56 L 50 62 L 56 56 L 62 60" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <rect x="44" y="57" width="12" height="6" rx="1" fill="white" opacity="0.7" />
      ) : mood === "sleeping" || mood === "offline" ? (
        <line x1="40" y1="60" x2="60" y2="60" stroke="white" strokeWidth="2" opacity="0.5" />
      ) : (
        <line x1="38" y1="60" x2="62" y2="60" stroke="white" strokeWidth="2" strokeLinecap="round" />
      )}
      <text x="16" y="50" fontSize="10" fill="white" opacity="0.6">⚡</text>
      <text x="74" y="50" fontSize="10" fill="white" opacity="0.6">⚡</text>
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 3. Cat ─────────────────────────────────────────── */
export function CatFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;
  const eyeRy = blink || isAsleep ? 1 : mood === "excited" ? 10 : mood === "focused" ? 5 : 8;

  return (
    <Wrapper size={size}>
      <polygon points="15,30 25,5 35,28" fill="white" opacity="0.55" />
      <polygon points="85,30 75,5 65,28" fill="white" opacity="0.55" />
      <polygon points="20,28 25,12 30,27" fill="white" opacity="0.3" />
      <polygon points="80,28 75,12 70,27" fill="white" opacity="0.3" />
      <ellipse cx={37 + dx * 0.5} cy="42" rx="9" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <ellipse cx={37 + dx} cy="42" rx="2" ry={mood === "excited" ? 5 : 4} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx={63 + dx * 0.5} cy="42" rx="9" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <ellipse cx={63 + dx} cy="42" rx="2" ry={mood === "excited" ? 5 : 4} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <polygon points="48,54 52,54 50,57" fill="white" opacity="0.7" />
      <line x1="10" y1="52" x2="32" y2="55" stroke="white" strokeWidth="1.5" opacity="0.7" />
      <line x1="10" y1="58" x2="32" y2="58" stroke="white" strokeWidth="1.5" opacity="0.7" />
      <line x1="68" y1="55" x2="90" y2="52" stroke="white" strokeWidth="1.5" opacity="0.7" />
      <line x1="68" y1="58" x2="90" y2="58" stroke="white" strokeWidth="1.5" opacity="0.7" />
      {mood === "idle" || mood === "working" ? (
        <path d="M 44 60 Q 47 65 50 60 Q 53 65 56 60" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "excited" ? (
        <path d="M 40 58 Q 45 68 50 58 Q 55 68 60 58" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "error" ? (
        <path d="M 42 64 Q 50 58 58 64" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "confused" ? (
        <path d="M 44 60 Q 47 57 50 60 Q 53 63 56 60" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <circle cx="50" cy="62" r="3" fill="white" opacity="0.8" />
      ) : (
        <line x1="44" y1="60" x2="56" y2="60" stroke="white" strokeWidth="1.5" opacity="0.5" />
      )}
      {getEyebrows(mood)}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 4. Alien ───────────────────────────────────────── */
export function AlienFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;

  return (
    <Wrapper size={size}>
      <line x1="38" y1="22" x2="30" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <circle cx="30" cy="6" r="4" fill="white" opacity="0.85" />
      <line x1="62" y1="22" x2="70" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <circle cx="70" cy="6" r="4" fill="white" opacity="0.85" />
      <ellipse cx={35 + dx * 0.5} cy="40" rx="12" ry={blink || isAsleep ? 1 : mood === "excited" ? 14 : 10} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={35 + dx} cy="40" r={mood === "excited" ? 5 : 4} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx={65 + dx * 0.5} cy="40" rx="12" ry={blink || isAsleep ? 1 : mood === "excited" ? 14 : 10} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={65 + dx} cy="40" r={mood === "excited" ? 5 : 4} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      {mood === "idle" || mood === "working" ? (
        <path d="M 45 62 Q 50 67 55 62" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "excited" ? (
        <ellipse cx="50" cy="64" rx="6" ry="4" fill="white" opacity="0.8" />
      ) : mood === "thinking" ? (
        <circle cx="50" cy="64" r="2.5" fill="white" opacity="0.7" />
      ) : mood === "error" ? (
        <path d="M 44 66 Q 50 60 56 66" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "confused" ? (
        <path d="M 46 64 Q 50 60 54 64" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <line x1="46" y1="64" x2="54" y2="64" stroke="white" strokeWidth="1.5" opacity="0.5" />
      )}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 5. Ghost ───────────────────────────────────────── */
export function GhostFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;

  return (
    <Wrapper size={size}>
      <path d="M 25 75 Q 30 68 35 75 Q 40 82 45 75 Q 50 68 55 75 Q 60 82 65 75 Q 70 68 75 75 L 75 35 Q 75 15 50 15 Q 25 15 25 35 Z" fill="white" opacity="0.2" />
      <circle cx={37 + dx * 0.5} cy="40" r={blink || isAsleep ? 1 : 10} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={37 + dx} cy="40" r={mood === "excited" ? 6 : 5} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <circle cx={63 + dx * 0.5} cy="40" r={blink || isAsleep ? 1 : 10} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={63 + dx} cy="40" r={mood === "excited" ? 6 : 5} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      {mood === "idle" || mood === "working" ? (
        <ellipse cx="50" cy="62" rx="6" ry="8" fill="white" opacity="0.7" />
      ) : mood === "excited" ? (
        <ellipse cx="50" cy="60" rx="8" ry="10" fill="white" opacity="0.8" />
      ) : mood === "error" || mood === "confused" ? (
        <ellipse cx="50" cy="62" rx="5" ry="6" fill="white" opacity="0.6" />
      ) : mood === "thinking" ? (
        <ellipse cx="50" cy="62" rx="4" ry="5" fill="white" opacity="0.6" />
      ) : (
        <line x1="44" y1="62" x2="56" y2="62" stroke="white" strokeWidth="2" opacity="0.4" />
      )}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 6. Owl ─────────────────────────────────────────── */
export function OwlFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;
  const eyeR = mood === "excited" ? 13 : 11;

  return (
    <Wrapper size={size}>
      <polygon points="22,28 18,10 32,24" fill="white" opacity="0.5" />
      <polygon points="78,28 82,10 68,24" fill="white" opacity="0.5" />
      <circle cx="37" cy="42" r="14" fill="none" stroke="white" strokeWidth="2.5" opacity="0.5" />
      <circle cx="63" cy="42" r="14" fill="none" stroke="white" strokeWidth="2.5" opacity="0.5" />
      <circle cx={37 + dx * 0.5} cy="42" r={blink || isAsleep ? 1 : eyeR} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={37 + dx} cy="42" r={mood === "excited" ? 5 : 4} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <circle cx={63 + dx * 0.5} cy="42" r={blink || isAsleep ? 1 : eyeR} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={63 + dx} cy="42" r={mood === "excited" ? 5 : 4} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      {mood === "idle" || mood === "working" ? (
        <polygon points="47,58 50,64 53,58" fill="white" opacity="0.8" />
      ) : mood === "excited" ? (
        <polygon points="45,56 50,66 55,56" fill="white" opacity="0.9" />
      ) : mood === "thinking" ? (
        <polygon points="48,58 50,62 52,58" fill="white" opacity="0.6" />
      ) : mood === "error" ? (
        <polygon points="47,62 50,56 53,62" fill="white" opacity="0.7" />
      ) : (
        <polygon points="48,58 50,62 52,58" fill="white" opacity="0.4" />
      )}
      {getEyebrows(mood)}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 7. Panda ───────────────────────────────────────── */
export function PandaFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;

  return (
    <Wrapper size={size}>
      <circle cx="20" cy="18" r="10" fill="white" opacity="0.45" />
      <circle cx="80" cy="18" r="10" fill="white" opacity="0.45" />
      <circle cx="20" cy="18" r="6" fill="rgba(0,0,0,0.3)" />
      <circle cx="80" cy="18" r="6" fill="rgba(0,0,0,0.3)" />
      <ellipse cx="37" cy="42" rx="13" ry="11" fill="rgba(0,0,0,0.4)" />
      <ellipse cx="63" cy="42" rx="13" ry="11" fill="rgba(0,0,0,0.4)" />
      <ellipse cx={37 + dx * 0.5} cy="42" rx="7" ry={blink || isAsleep ? 1 : mood === "excited" ? 9 : 7} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={37 + dx} cy="42" r={mood === "excited" ? 4 : 3} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx={63 + dx * 0.5} cy="42" rx="7" ry={blink || isAsleep ? 1 : mood === "excited" ? 9 : 7} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={63 + dx} cy="42" r={mood === "excited" ? 4 : 3} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx="50" cy="54" rx="4" ry="3" fill="white" opacity="0.6" />
      {getMouthPath(mood)}
      {getEyebrows(mood)}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 8. Fox ─────────────────────────────────────────── */
export function FoxFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;
  const eyeRy = blink || isAsleep ? 1 : mood === "excited" ? 7 : mood === "focused" ? 3 : 5;

  return (
    <Wrapper size={size}>
      <polygon points="15,32 22,5 35,28" fill="white" opacity="0.55" />
      <polygon points="85,32 78,5 65,28" fill="white" opacity="0.55" />
      <polygon points="20,28 23,12 30,26" fill="white" opacity="0.3" />
      <polygon points="80,28 77,12 70,26" fill="white" opacity="0.3" />
      <ellipse cx={37 + dx * 0.5} cy="42" rx="10" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <ellipse cx={37 + dx} cy="42" rx="3" ry={Math.max(eyeRy - 2, 2)} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx={63 + dx * 0.5} cy="42" rx="10" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <ellipse cx={63 + dx} cy="42" rx="3" ry={Math.max(eyeRy - 2, 2)} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <polygon points="48,53 52,53 50,57" fill="white" opacity="0.7" />
      {mood === "idle" || mood === "working" ? (
        <path d="M 42 60 Q 46 65 50 60 Q 54 65 58 60" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      ) : mood === "excited" ? (
        <path d="M 38 58 Q 44 68 50 58 Q 56 68 62 58" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "confused" ? (
        <path d="M 44 60 Q 50 56 56 60" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      ) : mood === "error" ? (
        <path d="M 42 64 Q 50 58 58 64" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <circle cx="50" cy="62" r="2.5" fill="white" opacity="0.7" />
      ) : (
        <line x1="44" y1="60" x2="56" y2="60" stroke="white" strokeWidth="1.5" opacity="0.5" />
      )}
      {getEyebrows(mood)}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 9. Skull ───────────────────────────────────────── */
export function SkullFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;
  const eyeR = blink || isAsleep ? 1 : mood === "excited" ? 11 : 9;

  return (
    <Wrapper size={size}>
      <circle cx="37" cy="40" r="12" fill="rgba(0,0,0,0.4)" />
      <circle cx="63" cy="40" r="12" fill="rgba(0,0,0,0.4)" />
      <circle cx={37 + dx * 0.5} cy="40" r={eyeR} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={37 + dx} cy="40" r={mood === "excited" ? 5 : 4} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <circle cx={63 + dx * 0.5} cy="40" r={eyeR} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={63 + dx} cy="40" r={mood === "excited" ? 5 : 4} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <polygon points="48,54 52,54 50,57" fill="white" opacity="0.4" />
      {mood === "idle" || mood === "working" || mood === "excited" ? (
        <g>
          <line x1="34" y1="64" x2="66" y2="64" stroke="white" strokeWidth="2" />
          {[38, 44, 50, 56, 62].map((x) => (<line key={x} x1={x} y1="60" x2={x} y2="68" stroke="white" strokeWidth="1.5" />))}
        </g>
      ) : mood === "error" ? (
        <g>
          <line x1="36" y1="64" x2="64" y2="64" stroke="white" strokeWidth="2" />
          {[40, 46, 52, 58].map((x) => (<line key={x} x1={x} y1="61" x2={x} y2="67" stroke="white" strokeWidth="1.5" />))}
        </g>
      ) : mood === "confused" ? (
        <path d="M 40 62 Q 44 58 48 62 Q 52 66 56 62 Q 60 58 64 62" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <rect x="44" y="60" width="12" height="6" rx="1" fill="white" opacity="0.6" />
      ) : (
        <line x1="40" y1="62" x2="60" y2="62" stroke="white" strokeWidth="2" opacity="0.5" />
      )}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 10. Pixel ──────────────────────────────────────── */
export function PixelFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = Math.round(lookX * 2) * 2;
  const eyeH = blink || isAsleep ? 2 : mood === "excited" ? 10 : mood === "focused" ? 4 : 8;

  return (
    <Wrapper size={size}>
      <rect x={30 + dx * 0.5} y={38} width="10" height={eyeH} fill="white" style={{ transition: "all 0.15s steps(3)" }} />
      {!isAsleep && !blink && <rect x={33 + dx} y={40} width="4" height={Math.max(eyeH - 4, 2)} fill="#1f2937" style={{ transition: "all 0.15s steps(3)" }} />}
      <rect x={60 + dx * 0.5} y={38} width="10" height={eyeH} fill="white" style={{ transition: "all 0.15s steps(3)" }} />
      {!isAsleep && !blink && <rect x={63 + dx} y={40} width="4" height={Math.max(eyeH - 4, 2)} fill="#1f2937" style={{ transition: "all 0.15s steps(3)" }} />}
      {mood === "idle" || mood === "working" ? (
        <g>
          <rect x="38" y="58" width="4" height="4" fill="white" opacity="0.8" />
          <rect x="42" y="62" width="4" height="4" fill="white" opacity="0.8" />
          <rect x="46" y="64" width="8" height="4" fill="white" opacity="0.8" />
          <rect x="54" y="62" width="4" height="4" fill="white" opacity="0.8" />
          <rect x="58" y="58" width="4" height="4" fill="white" opacity="0.8" />
        </g>
      ) : mood === "excited" ? (
        <g>
          <rect x="36" y="56" width="4" height="4" fill="white" />
          <rect x="40" y="60" width="4" height="4" fill="white" />
          <rect x="44" y="64" width="12" height="4" fill="white" />
          <rect x="56" y="60" width="4" height="4" fill="white" />
          <rect x="60" y="56" width="4" height="4" fill="white" />
        </g>
      ) : mood === "error" ? (
        <g>
          <rect x="38" y="64" width="4" height="4" fill="white" />
          <rect x="42" y="60" width="4" height="4" fill="white" />
          <rect x="46" y="58" width="8" height="4" fill="white" />
          <rect x="54" y="60" width="4" height="4" fill="white" />
          <rect x="58" y="64" width="4" height="4" fill="white" />
        </g>
      ) : mood === "confused" ? (
        <g>
          <rect x="40" y="60" width="4" height="4" fill="white" />
          <rect x="44" y="56" width="4" height="4" fill="white" />
          <rect x="48" y="60" width="4" height="4" fill="white" />
          <rect x="52" y="56" width="4" height="4" fill="white" />
          <rect x="56" y="60" width="4" height="4" fill="white" />
        </g>
      ) : mood === "thinking" ? (
        <rect x="44" y="58" width="12" height="4" fill="white" opacity="0.7" />
      ) : (
        <rect x="40" y="60" width="20" height="2" fill="white" opacity="0.5" />
      )}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 11. Developer ──────────────────────────────────── */
export function DevFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;
  const eyeRy = blink || isAsleep ? 1 : mood === "excited" ? 9 : mood === "focused" ? 5 : 7;

  return (
    <Wrapper size={size}>
      <rect x="24" y="32" width="20" height="16" rx="3" fill="none" stroke="white" strokeWidth="2.5" opacity="0.8" />
      <rect x="56" y="32" width="20" height="16" rx="3" fill="none" stroke="white" strokeWidth="2.5" opacity="0.8" />
      <line x1="44" y1="38" x2="56" y2="38" stroke="white" strokeWidth="2" opacity="0.7" />
      <line x1="24" y1="36" x2="14" y2="34" stroke="white" strokeWidth="2" opacity="0.6" />
      <line x1="76" y1="36" x2="86" y2="34" stroke="white" strokeWidth="2" opacity="0.6" />
      <ellipse cx={34 + dx * 0.5} cy="40" rx="6" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={34 + dx} cy="40" r={mood === "excited" ? 3.5 : 3} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx={66 + dx * 0.5} cy="40" rx="6" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={66 + dx} cy="40" r={mood === "excited" ? 3.5 : 3} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <text x="30" y="22" fontSize="14" fontWeight="bold" fill="white" opacity="0.5">{"{"}</text>
      <text x="60" y="22" fontSize="14" fontWeight="bold" fill="white" opacity="0.5">{"}"}</text>
      {mood === "idle" || mood === "working" ? (
        <path d="M 40 58 Q 50 66 60 58" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "excited" ? (
        <path d="M 36 56 Q 50 70 64 56" fill="white" opacity="0.8" stroke="white" strokeWidth="2" />
      ) : mood === "focused" ? (
        <line x1="42" y1="60" x2="58" y2="60" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <ellipse cx="50" cy="60" rx="4" ry="5" fill="white" opacity="0.8" />
      ) : mood === "confused" ? (
        <path d="M 40 60 Q 45 56 50 60 Q 55 64 60 60" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : mood === "error" ? (
        <path d="M 40 64 Q 50 56 60 64" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <line x1="42" y1="60" x2="58" y2="60" stroke="white" strokeWidth="2" opacity="0.5" />
      )}
      {getEyebrows(mood)}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 12. Doctor ─────────────────────────────────────── */
export function DoctorFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;
  const eyeRy = blink || isAsleep ? 1 : mood === "excited" ? 10 : 8;

  return (
    <Wrapper size={size}>
      <circle cx="50" cy="10" r="7" fill="none" stroke="white" strokeWidth="2" opacity="0.7" />
      <circle cx="50" cy="10" r="4" fill="white" opacity="0.3" />
      <path d="M 20 18 Q 50 8 80 18" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
      <ellipse cx={37 + dx * 0.5} cy="42" rx="8" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={37 + dx} cy="42" r={mood === "excited" ? 4 : 3.5} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx={63 + dx * 0.5} cy="42" rx="8" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={63 + dx} cy="42" r={mood === "excited" ? 4 : 3.5} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <g opacity="0.6">
        <rect x="12" y="48" width="10" height="3" rx="1" fill="white" />
        <rect x="15.5" y="44.5" width="3" height="10" rx="1" fill="white" />
      </g>
      <path d="M 78 38 Q 85 50 80 62 Q 76 70 70 72" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      <circle cx="70" cy="72" r="3" fill="white" opacity="0.5" />
      {mood === "idle" || mood === "working" ? (
        <path d="M 40 60 Q 50 68 60 60" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "excited" ? (
        <path d="M 36 58 Q 50 72 64 58" fill="white" opacity="0.8" stroke="white" strokeWidth="2" />
      ) : mood === "focused" ? (
        <line x1="42" y1="62" x2="58" y2="62" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <ellipse cx="50" cy="62" rx="4" ry="5" fill="white" opacity="0.8" />
      ) : mood === "error" ? (
        <path d="M 40 66 Q 50 58 60 66" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "confused" ? (
        <path d="M 42 62 Q 46 58 50 62 Q 54 66 58 62" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <line x1="42" y1="62" x2="58" y2="62" stroke="white" strokeWidth="2" opacity="0.5" />
      )}
      {getEyebrows(mood)}
      {getExtras(mood)}
    </Wrapper>
  );
}

/* ─── 13. Fitness ────────────────────────────────────── */
export function FitnessFace(props: FaceProps) {
  const { mood, size, blinkPhase, lookX } = props;
  const isAsleep = mood === "sleeping";
  const blink = blinkPhase && !isAsleep && mood !== "offline";
  const dx = lookX * 3;
  const eyeRy = blink || isAsleep ? 1 : mood === "excited" ? 10 : mood === "focused" ? 5 : 8;

  return (
    <Wrapper size={size}>
      <path d="M 15 26 Q 50 18 85 26" fill="none" stroke="white" strokeWidth="4" opacity="0.6" strokeLinecap="round" />
      <path d="M 20 26 Q 50 20 80 26" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
      <ellipse cx={37 + dx * 0.5} cy="42" rx="8" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={37 + dx} cy="42" r={mood === "excited" ? 4.5 : 3.5} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <ellipse cx={63 + dx * 0.5} cy="42" rx="8" ry={eyeRy} fill="white" style={{ transition: "all 0.2s ease" }} />
      {!isAsleep && !blink && <circle cx={63 + dx} cy="42" r={mood === "excited" ? 4.5 : 3.5} fill="#1f2937" style={{ transition: "all 0.2s ease" }} />}
      <g opacity="0.6" transform="translate(8, 56)">
        <rect x="0" y="2" width="4" height="8" rx="1" fill="white" />
        <rect x="4" y="4" width="8" height="4" rx="0.5" fill="white" />
        <rect x="12" y="2" width="4" height="8" rx="1" fill="white" />
      </g>
      {(mood === "working" || mood === "excited") && (
        <ellipse cx="80" cy="34" rx="2.5" ry="3.5" fill="white" opacity="0.6">
          <animate attributeName="cy" values="34;42;34" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
        </ellipse>
      )}
      {mood === "idle" || mood === "working" ? (
        <path d="M 38 58 Q 50 70 62 58" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
      ) : mood === "excited" ? (
        <path d="M 34 55 Q 50 75 66 55" fill="white" opacity="0.9" stroke="white" strokeWidth="2" />
      ) : mood === "focused" ? (
        <line x1="40" y1="60" x2="60" y2="60" stroke="white" strokeWidth="3" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <ellipse cx="50" cy="60" rx="4" ry="5" fill="white" opacity="0.8" />
      ) : mood === "error" ? (
        <path d="M 38 64 Q 50 56 62 64" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "confused" ? (
        <path d="M 40 60 Q 45 56 50 60 Q 55 64 60 60" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <line x1="42" y1="60" x2="58" y2="60" stroke="white" strokeWidth="2" opacity="0.5" />
      )}
      {getEyebrows(mood)}
      {getExtras(mood)}
    </Wrapper>
  );
}
