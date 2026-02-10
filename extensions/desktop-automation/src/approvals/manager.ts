/**
 * GUI Approval Manager
 *
 * Manages approval settings and allowlists for GUI automation actions.
 * Follows the pattern from exec-approvals.ts for consistency.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type GuiApprovalMode = "none" | "destructive" | "all";
export type GuiAskFallback = "deny" | "allow";

export interface GuiAllowlistEntry {
  id: string;
  appPattern: string;
  actionType: string;
  lastUsedAt?: number;
  description?: string;
}

export interface GuiApprovalsDefaults {
  mode?: GuiApprovalMode;
  askFallback?: GuiAskFallback;
  screenshotOnApproval?: boolean;
}

export interface GuiApprovalsAgent extends GuiApprovalsDefaults {
  allowedApps?: string[];
  deniedApps?: string[];
  allowlist?: GuiAllowlistEntry[];
}

export interface GuiApprovalsFile {
  version: 1;
  defaults?: GuiApprovalsDefaults;
  agents?: Record<string, GuiApprovalsAgent>;
}

export interface GuiApprovalsResolved {
  path: string;
  mode: GuiApprovalMode;
  askFallback: GuiAskFallback;
  screenshotOnApproval: boolean;
  allowedApps: string[];
  deniedApps: string[];
  allowlist: GuiAllowlistEntry[];
}

const DEFAULT_MODE: GuiApprovalMode = "destructive";
const DEFAULT_ASK_FALLBACK: GuiAskFallback = "deny";
const DEFAULT_SCREENSHOT_ON_APPROVAL = true;
const DEFAULT_FILE = "~/.thinkfleet/gui-approvals.json";

// Default blocked apps
const DEFAULT_DENIED_APPS_WINDOWS = [
  "cmd.exe",
  "powershell.exe",
  "pwsh.exe",
  "regedit.exe",
  "mmc.exe",
];

const DEFAULT_DENIED_APPS_MACOS = [
  "Terminal",
  "Terminal.app",
  "iTerm",
  "iTerm.app",
];

function expandHome(value: string): string {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function resolveGuiApprovalsPath(): string {
  return expandHome(DEFAULT_FILE);
}

function getDefaultDeniedApps(): string[] {
  if (process.platform === "win32") {
    return DEFAULT_DENIED_APPS_WINDOWS;
  } else if (process.platform === "darwin") {
    return DEFAULT_DENIED_APPS_MACOS;
  }
  return [];
}

export function loadGuiApprovals(): GuiApprovalsFile {
  const filePath = resolveGuiApprovalsPath();

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as GuiApprovalsFile;
      return parsed;
    }
  } catch (error) {
    console.error("Failed to load gui-approvals.json:", error);
  }

  return { version: 1 };
}

export function saveGuiApprovals(file: GuiApprovalsFile): void {
  const filePath = resolveGuiApprovalsPath();

  try {
    ensureDir(filePath);
    const content = JSON.stringify(file, null, 2);
    fs.writeFileSync(filePath, content, { mode: 0o600 });
  } catch (error) {
    console.error("Failed to save gui-approvals.json:", error);
    throw error;
  }
}

export function resolveGuiApprovals(agentId = "main"): GuiApprovalsResolved {
  const file = loadGuiApprovals();
  const defaults = file.defaults || {};
  const agent = file.agents?.[agentId] || {};

  const mode = agent.mode ?? defaults.mode ?? DEFAULT_MODE;
  const askFallback = agent.askFallback ?? defaults.askFallback ?? DEFAULT_ASK_FALLBACK;
  const screenshotOnApproval =
    agent.screenshotOnApproval ?? defaults.screenshotOnApproval ?? DEFAULT_SCREENSHOT_ON_APPROVAL;

  // Merge denied apps: defaults + platform defaults + agent overrides
  const deniedApps = new Set<string>(getDefaultDeniedApps());
  for (const app of agent.deniedApps || []) {
    deniedApps.add(app);
  }

  return {
    path: resolveGuiApprovalsPath(),
    mode,
    askFallback,
    screenshotOnApproval,
    allowedApps: agent.allowedApps || [],
    deniedApps: Array.from(deniedApps),
    allowlist: agent.allowlist || [],
  };
}

export function isAppDenied(appName: string, resolved: GuiApprovalsResolved): boolean {
  const appLower = appName.toLowerCase();
  return resolved.deniedApps.some((denied) => appLower.includes(denied.toLowerCase()));
}

export function isActionAllowlisted(
  appName: string,
  actionType: string,
  resolved: GuiApprovalsResolved,
): GuiAllowlistEntry | null {
  const appLower = appName.toLowerCase();
  const actionLower = actionType.toLowerCase();

  for (const entry of resolved.allowlist) {
    const patternMatch = appLower.includes(entry.appPattern.toLowerCase());
    const actionMatch = entry.actionType === "*" || actionLower === entry.actionType.toLowerCase();

    if (patternMatch && actionMatch) {
      return entry;
    }
  }

  return null;
}

export function addToAllowlist(
  agentId: string,
  appPattern: string,
  actionType: string,
  description?: string,
): GuiAllowlistEntry {
  const file = loadGuiApprovals();

  if (!file.agents) {
    file.agents = {};
  }

  if (!file.agents[agentId]) {
    file.agents[agentId] = {};
  }

  if (!file.agents[agentId].allowlist) {
    file.agents[agentId].allowlist = [];
  }

  const entry: GuiAllowlistEntry = {
    id: crypto.randomUUID(),
    appPattern,
    actionType,
    lastUsedAt: Date.now(),
    description,
  };

  file.agents[agentId].allowlist.push(entry);
  saveGuiApprovals(file);

  return entry;
}

export function removeFromAllowlist(agentId: string, entryId: string): boolean {
  const file = loadGuiApprovals();
  const allowlist = file.agents?.[agentId]?.allowlist;

  if (!allowlist) {
    return false;
  }

  const index = allowlist.findIndex((e) => e.id === entryId);
  if (index === -1) {
    return false;
  }

  allowlist.splice(index, 1);
  saveGuiApprovals(file);

  return true;
}

export function updateAllowlistUsage(agentId: string, entryId: string): void {
  const file = loadGuiApprovals();
  const entry = file.agents?.[agentId]?.allowlist?.find((e) => e.id === entryId);

  if (entry) {
    entry.lastUsedAt = Date.now();
    saveGuiApprovals(file);
  }
}
