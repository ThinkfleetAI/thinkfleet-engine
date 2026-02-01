export type AgentMood =
  | "idle"
  | "thinking"
  | "working"
  | "focused"
  | "excited"
  | "confused"
  | "error"
  | "sleeping"
  | "offline";

export interface FaceProps {
  mood: AgentMood;
  size: number; // pixel size for kiosk (full-screen)
  blinkPhase: boolean;
  lookX: number;
}

export interface CharacterDef {
  key: string;
  name: string;
  gradient: [string, string]; // [from, to] hex colors
  render: (props: FaceProps) => React.JSX.Element;
}

import {
  DefaultFace,
  RobotFace,
  CatFace,
  AlienFace,
  GhostFace,
  OwlFace,
  PandaFace,
  FoxFace,
  SkullFace,
  PixelFace,
  DevFace,
  DoctorFace,
  FitnessFace,
} from "./faces";

export const CHARACTERS: CharacterDef[] = [
  { key: "default", name: "Classic", gradient: ["#4ade80", "#10b981"], render: DefaultFace },
  { key: "robot", name: "Robot", gradient: ["#94a3b8", "#71717a"], render: RobotFace },
  { key: "cat", name: "Cat", gradient: ["#fbbf24", "#f97316"], render: CatFace },
  { key: "alien", name: "Alien", gradient: ["#a3e635", "#16a34a"], render: AlienFace },
  { key: "ghost", name: "Ghost", gradient: ["#a5b4fc", "#c084fc"], render: GhostFace },
  { key: "owl", name: "Owl", gradient: ["#d97706", "#92400e"], render: OwlFace },
  { key: "panda", name: "Panda", gradient: ["#d1d5db", "#94a3b8"], render: PandaFace },
  { key: "fox", name: "Fox", gradient: ["#fb923c", "#ef4444"], render: FoxFace },
  { key: "skull", name: "Skull", gradient: ["#4b5563", "#1f2937"], render: SkullFace },
  { key: "pixel", name: "Pixel", gradient: ["#22d3ee", "#3b82f6"], render: PixelFace },
  { key: "developer", name: "Developer", gradient: ["#a78bfa", "#4f46e5"], render: DevFace },
  { key: "doctor", name: "Doctor", gradient: ["#2dd4bf", "#059669"], render: DoctorFace },
  { key: "fitness", name: "Fitness", gradient: ["#f87171", "#e11d48"], render: FitnessFace },
];

export const CHARACTER_MAP: Record<string, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.key, c]),
);

export function getCharacter(key: string | null | undefined): CharacterDef {
  return CHARACTER_MAP[key ?? "default"] ?? CHARACTER_MAP.default;
}
