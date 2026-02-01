import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ThinkfleetConfig } from "./types.js";

/**
 * Nix mode detection: When THINKFLEET_NIX_MODE=1, the gateway is running under Nix.
 */
export function resolveIsNixMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.THINKFLEET_NIX_MODE === "1";
}

export const isNixMode = resolveIsNixMode();

const STATE_DIRNAME = ".thinkfleet";
const CONFIG_FILENAME = "thinkfleet.json";

function stateDir(homedir: () => string = os.homedir): string {
  return path.join(homedir(), STATE_DIRNAME);
}

export function resolveStateDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const override = env.THINKFLEET_STATE_DIR?.trim();
  if (override) return resolveUserPath(override);
  return stateDir(homedir);
}

function resolveUserPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

export const STATE_DIR = resolveStateDir();

/**
 * Config file path (JSON5).
 * Can be overridden via THINKFLEET_CONFIG_PATH.
 * Default: ~/.thinkfleet/thinkfleet.json
 */
export function resolveCanonicalConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDirPath: string = resolveStateDir(env, os.homedir),
): string {
  const override = env.THINKFLEET_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override);
  return path.join(stateDirPath, CONFIG_FILENAME);
}

/**
 * Resolve the active config path by preferring an existing config file
 * before falling back to the canonical path.
 */
export function resolveConfigPathCandidate(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const candidates = resolveDefaultConfigCandidates(env, homedir);
  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) return existing;
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}

/**
 * Active config path.
 */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDirPath: string = resolveStateDir(env, os.homedir),
  homedir: () => string = os.homedir,
): string {
  const override = env.THINKFLEET_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override);
  const candidate = path.join(stateDirPath, CONFIG_FILENAME);
  try {
    if (fs.existsSync(candidate)) return candidate;
  } catch {}
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}

export const CONFIG_PATH = resolveConfigPathCandidate();

/**
 * Resolve default config path candidates.
 */
export function resolveDefaultConfigCandidates(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string[] {
  const explicit = env.THINKFLEET_CONFIG_PATH?.trim();
  if (explicit) return [resolveUserPath(explicit)];

  const candidates: string[] = [];
  const stateDirOverride = env.THINKFLEET_STATE_DIR?.trim();
  if (stateDirOverride) {
    candidates.push(path.join(resolveUserPath(stateDirOverride), CONFIG_FILENAME));
  }

  candidates.push(path.join(stateDir(homedir), CONFIG_FILENAME));
  return candidates;
}

export const DEFAULT_GATEWAY_PORT = 18789;

/**
 * Gateway lock directory (ephemeral).
 * Default: os.tmpdir()/thinkfleet-<uid>
 */
export function resolveGatewayLockDir(tmpdir: () => string = os.tmpdir): string {
  const base = tmpdir();
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `thinkfleet-${uid}` : "thinkfleet";
  return path.join(base, suffix);
}

const OAUTH_FILENAME = "oauth.json";

/**
 * OAuth credentials storage directory.
 * Override: THINKFLEET_OAUTH_DIR
 * Default: ~/.thinkfleet/credentials
 */
export function resolveOAuthDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDirPath: string = resolveStateDir(env, os.homedir),
): string {
  const override = env.THINKFLEET_OAUTH_DIR?.trim();
  if (override) return resolveUserPath(override);
  return path.join(stateDirPath, "credentials");
}

export function resolveOAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDirPath: string = resolveStateDir(env, os.homedir),
): string {
  return path.join(resolveOAuthDir(env, stateDirPath), OAUTH_FILENAME);
}

export function resolveGatewayPort(
  cfg?: ThinkfleetConfig,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const envRaw = env.THINKFLEET_GATEWAY_PORT?.trim();
  if (envRaw) {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const configPort = cfg?.gateway?.port;
  if (typeof configPort === "number" && Number.isFinite(configPort)) {
    if (configPort > 0) return configPort;
  }
  return DEFAULT_GATEWAY_PORT;
}

// Legacy re-exports for compatibility during transition
export const resolveLegacyStateDir = resolveStateDir;
export const resolveNewStateDir = resolveStateDir;
