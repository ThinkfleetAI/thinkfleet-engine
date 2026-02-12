import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type { ToolAuditEntry, ToolAuditOutcome } from "./tool-audit-log.js";

type ToolOutcomeCounts = {
  total: number;
  allowed: number;
  approved: number;
  rejected: number;
  blocked: number;
  timeout: number;
};

export type ToolGuardrailStats = {
  updatedAt: number;
  totalCalls: number;
  byOutcome: Record<string, number>;
  byTool: Record<string, ToolOutcomeCounts>;
  avgResponseTimeMs: number;
};

function emptyOutcomeCounts(): ToolOutcomeCounts {
  return { total: 0, allowed: 0, approved: 0, rejected: 0, blocked: 0, timeout: 0 };
}

function emptyStats(): ToolGuardrailStats {
  return {
    updatedAt: 0,
    totalCalls: 0,
    byOutcome: {},
    byTool: {},
    avgResponseTimeMs: 0,
  };
}

const STATS_FILENAME = "tool-guardrail-stats.json";

export class ToolGuardrailStatsTracker {
  private stats: ToolGuardrailStats = emptyStats();
  private responseTimes: number[] = [];

  record(entry: ToolAuditEntry): void {
    this.stats.updatedAt = Date.now();
    this.stats.totalCalls += 1;

    // byOutcome
    this.stats.byOutcome[entry.outcome] = (this.stats.byOutcome[entry.outcome] ?? 0) + 1;

    // byTool
    const toolStats =
      this.stats.byTool[entry.toolName] ??
      (this.stats.byTool[entry.toolName] = emptyOutcomeCounts());
    toolStats.total += 1;
    const outcomeKey = entry.outcome as keyof ToolOutcomeCounts;
    if (outcomeKey in toolStats && outcomeKey !== "total") {
      (toolStats[outcomeKey] as number) += 1;
    }

    // Response time tracking for ASK decisions
    if (entry.responseTimeMs !== undefined && entry.responseTimeMs > 0) {
      this.responseTimes.push(entry.responseTimeMs);
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.stats.avgResponseTimeMs = Math.round(sum / this.responseTimes.length);
    }
  }

  getSnapshot(): ToolGuardrailStats {
    return { ...this.stats };
  }

  flush(): void {
    const stateDir = resolveStateDir();
    const filePath = path.join(stateDir, STATS_FILENAME);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(this.stats, null, 2) + "\n", {
      mode: 0o600,
    });
  }

  loadFromDisk(): void {
    try {
      const stateDir = resolveStateDir();
      const filePath = path.join(stateDir, STATS_FILENAME);
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as ToolGuardrailStats;
      if (parsed && typeof parsed.totalCalls === "number") {
        this.stats = parsed;
      }
    } catch {
      // No existing stats file or invalid — start fresh
    }
  }
}

/** Singleton stats tracker instance. */
export const toolGuardrailStats = new ToolGuardrailStatsTracker();
