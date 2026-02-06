/**
 * Skills Catalog System
 *
 * Provides a compact listing of available skills for the prompt system.
 * Instead of injecting full skill content (~23K tokens for 300+ skills),
 * we inject just a catalog (~200-300 tokens) with name + description.
 *
 * Agents read individual SKILL.md files on-demand when they need
 * detailed instructions for a specific skill.
 *
 * Files:
 * - generate-skills-catalog.ts: Script to generate SKILLS_CATALOG.md
 * - SKILLS_CATALOG.md: Generated catalog (in docs/reference/templates/)
 */

import fs from "node:fs";
import path from "node:path";
import type { SkillEntry, SkillSnapshot } from "../types.js";

const CATALOG_FILENAME = "SKILLS_CATALOG.md";

/**
 * Skill category definitions for grouping in the compact catalog.
 */
const SKILL_CATEGORIES: Record<string, { keywords: string[]; label: string }> = {
  cloud: {
    keywords: [
      "aws",
      "azure",
      "gcloud",
      "terraform",
      "kubernetes",
      "k8s",
      "docker",
      "flyio",
      "coolify",
      "cloudflare",
      "argocd",
    ],
    label: "Cloud/DevOps",
  },
  dev: {
    keywords: [
      "typescript",
      "python",
      "rust",
      "react",
      "toolchain",
      "coding",
      "code-review",
      "clean-code",
      "test",
    ],
    label: "Development",
  },
  productivity: {
    keywords: [
      "gmail",
      "email",
      "slack",
      "discord",
      "twitter",
      "linear",
      "notion",
      "obsidian",
      "clickup",
      "monday",
      "calendar",
    ],
    label: "Productivity",
  },
  media: {
    keywords: [
      "video",
      "audio",
      "voice",
      "image",
      "pdf",
      "elevenlabs",
      "whisper",
      "pollinations",
      "excalidraw",
      "gif",
      "ffmpeg",
    ],
    label: "Media",
  },
  research: {
    keywords: [
      "search",
      "perplexity",
      "kagi",
      "brave",
      "arxiv",
      "deepwiki",
      "summarize",
      "news",
      "blog",
    ],
    label: "Research",
  },
  database: {
    keywords: [
      "database",
      "sql",
      "postgres",
      "mysql",
      "dynamo",
      "snowflake",
      "oracle",
      "redis",
      "mongo",
    ],
    label: "Database",
  },
  business: {
    keywords: [
      "shopify",
      "stripe",
      "xero",
      "quickbooks",
      "woocommerce",
      "bigcommerce",
      "pipedrive",
      "sendgrid",
      "mailchimp",
      "freshdesk",
    ],
    label: "Business",
  },
};

function categorizeSkill(name: string): string {
  const n = name.toLowerCase();
  for (const [cat, { keywords }] of Object.entries(SKILL_CATEGORIES)) {
    if (keywords.some((kw) => n.includes(kw))) return cat;
  }
  return "other";
}

/**
 * Build a compact skills catalog prompt from skill entries.
 *
 * This generates a minimal listing (~500-800 tokens) instead of
 * full skill content (~23K tokens).
 *
 * Format:
 * # Skills (327)
 * To use: read `skills/{name}/SKILL.md`
 *
 * **Cloud/DevOps:** aws-cli, aws-lambda, azure-aks, terraform, docker, ...
 * **Development:** typescript-expert, react-patterns, test-gen, ...
 * ...
 */
export function buildSkillsCatalogPrompt(
  entries: SkillEntry[],
  opts?: {
    maxChars?: number;
  },
): string {
  const maxChars = opts?.maxChars ?? 3000;

  // Group skills by category
  const byCategory = new Map<string, string[]>();
  for (const entry of entries) {
    const cat = categorizeSkill(entry.skill.name);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(entry.skill.name);
  }

  // Sort skills within each category
  for (const names of byCategory.values()) {
    names.sort();
  }

  const lines: string[] = [];
  lines.push(`# Skills (${entries.length})`);
  lines.push("");
  lines.push("To use a skill: read `skills/{name}/SKILL.md` for instructions.");
  lines.push("");

  // Ordered categories
  const categoryOrder = [
    "cloud",
    "dev",
    "productivity",
    "media",
    "research",
    "database",
    "business",
    "other",
  ];

  let currentLength = lines.join("\n").length;

  for (const cat of categoryOrder) {
    const names = byCategory.get(cat);
    if (!names || names.length === 0) continue;

    const label = SKILL_CATEGORIES[cat]?.label ?? "Other";
    const skillsList = names.join(", ");
    const line = `**${label}:** ${skillsList}`;

    if (currentLength + line.length + 2 > maxChars - 100) {
      // Truncate this category
      const availableChars = maxChars - currentLength - 100;
      const truncated = skillsList.slice(0, availableChars);
      const lastComma = truncated.lastIndexOf(",");
      const clean = lastComma > 0 ? truncated.slice(0, lastComma) : truncated;
      lines.push(`**${label}:** ${clean}, ...`);
      lines.push("");
      lines.push(`[Use \`skills list\` to see all ${entries.length} skills]`);
      break;
    }

    lines.push(line);
    lines.push("");
    currentLength += line.length + 2;
  }

  return lines.join("\n").trim();
}

function truncateDesc(desc: string, maxLen: number): string {
  if (desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen - 1) + "…";
}

/**
 * Resolve skills catalog from a pre-generated file or build dynamically.
 *
 * Checks for SKILLS_CATALOG.md in:
 * 1. Workspace directory
 * 2. Bundled templates directory
 *
 * Falls back to building dynamically from entries if no catalog file found.
 */
export function resolveSkillsCatalogPrompt(params: {
  workspaceDir: string;
  entries?: SkillEntry[];
  templatesDir?: string;
  maxChars?: number;
}): string | null {
  const { workspaceDir, entries, maxChars } = params;

  // Try loading pre-generated catalog from workspace
  const workspaceCatalog = path.join(workspaceDir, CATALOG_FILENAME);
  if (fs.existsSync(workspaceCatalog)) {
    try {
      const content = fs.readFileSync(workspaceCatalog, "utf-8");
      if (maxChars && content.length > maxChars) {
        return truncateCatalog(content, maxChars);
      }
      return content;
    } catch {
      // Fall through
    }
  }

  // Try loading from templates directory
  if (params.templatesDir) {
    const templateCatalog = path.join(params.templatesDir, CATALOG_FILENAME);
    if (fs.existsSync(templateCatalog)) {
      try {
        const content = fs.readFileSync(templateCatalog, "utf-8");
        if (maxChars && content.length > maxChars) {
          return truncateCatalog(content, maxChars);
        }
        return content;
      } catch {
        // Fall through
      }
    }
  }

  // Build dynamically from entries
  if (entries && entries.length > 0) {
    return buildSkillsCatalogPrompt(entries, { maxChars });
  }

  return null;
}

function truncateCatalog(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;

  // Find a good break point (end of a line)
  const truncated = content.slice(0, maxChars - 50);
  const lastNewline = truncated.lastIndexOf("\n");
  const clean = lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated;

  return `${clean}\n\n[Catalog truncated. Use \`skills list\` to see all available skills.]`;
}

/**
 * Create a minimal SkillSnapshot with just catalog info.
 *
 * Used when catalog mode is enabled to reduce token usage.
 */
export function buildCatalogSnapshot(
  entries: SkillEntry[],
  opts?: { maxChars?: number },
): SkillSnapshot {
  const prompt = buildSkillsCatalogPrompt(entries, opts);
  return {
    prompt,
    skills: entries.map((e) => ({
      name: e.skill.name,
      primaryEnv: e.metadata?.primaryEnv,
    })),
  };
}
