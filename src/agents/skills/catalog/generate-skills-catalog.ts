#!/usr/bin/env npx tsx
/**
 * Generate SKILLS_CATALOG.md from skill directories
 *
 * Run: npx tsx src/agents/skills/catalog/generate-skills-catalog.ts
 *
 * This script generates a compact markdown file listing all available skills.
 * Instead of injecting full skill content into the prompt (~23K tokens for 300+ skills),
 * we inject just this catalog (~200-300 tokens) and agents read SKILL.md on demand.
 */

import fs from "node:fs";
import path from "node:path";
import { loadSkillsFromDir, type Skill } from "@mariozechner/pi-coding-agent";
import { parseFrontmatter } from "../frontmatter.js";
import { resolveBundledSkillsDir } from "../bundled-dir.js";

interface SkillCatalogEntry {
  name: string;
  description: string;
  category?: string;
  emoji?: string;
}

/**
 * Categorize skills based on name patterns and metadata
 */
function inferCategory(name: string, metadata?: Record<string, unknown>): string {
  const n = name.toLowerCase();

  // Check metadata first
  if (metadata?.category && typeof metadata.category === "string") {
    return metadata.category;
  }

  // Cloud/DevOps
  if (
    n.includes("aws") ||
    n.includes("azure") ||
    n.includes("gcloud") ||
    n.includes("terraform") ||
    n.includes("kubernetes") ||
    n.includes("k8s") ||
    n.includes("docker") ||
    n.includes("flyio") ||
    n.includes("coolify") ||
    n.includes("cloudflare") ||
    n.includes("argocd")
  ) {
    return "cloud";
  }

  // Development
  if (
    n.includes("typescript") ||
    n.includes("python") ||
    n.includes("rust") ||
    n.includes("react") ||
    n.includes("toolchain") ||
    n.includes("coding") ||
    n.includes("code-review") ||
    n.includes("clean-code") ||
    n.includes("test")
  ) {
    return "dev";
  }

  // Productivity/Communication
  if (
    n.includes("gmail") ||
    n.includes("email") ||
    n.includes("slack") ||
    n.includes("discord") ||
    n.includes("twitter") ||
    n.includes("linear") ||
    n.includes("notion") ||
    n.includes("obsidian") ||
    n.includes("clickup") ||
    n.includes("monday") ||
    n.includes("calendar")
  ) {
    return "productivity";
  }

  // Media
  if (
    n.includes("video") ||
    n.includes("audio") ||
    n.includes("voice") ||
    n.includes("image") ||
    n.includes("pdf") ||
    n.includes("elevenlabs") ||
    n.includes("whisper") ||
    n.includes("pollinations") ||
    n.includes("excalidraw") ||
    n.includes("gif")
  ) {
    return "media";
  }

  // Search/Research
  if (
    n.includes("search") ||
    n.includes("perplexity") ||
    n.includes("kagi") ||
    n.includes("brave") ||
    n.includes("arxiv") ||
    n.includes("deepwiki") ||
    n.includes("summarize") ||
    n.includes("news") ||
    n.includes("blog")
  ) {
    return "research";
  }

  // Database
  if (
    n.includes("database") ||
    n.includes("sql") ||
    n.includes("postgres") ||
    n.includes("mysql") ||
    n.includes("dynamo") ||
    n.includes("snowflake") ||
    n.includes("oracle") ||
    n.includes("redis")
  ) {
    return "database";
  }

  // Business/E-commerce
  if (
    n.includes("shopify") ||
    n.includes("stripe") ||
    n.includes("xero") ||
    n.includes("quickbooks") ||
    n.includes("woocommerce") ||
    n.includes("bigcommerce") ||
    n.includes("pipedrive") ||
    n.includes("sendgrid") ||
    n.includes("mailchimp")
  ) {
    return "business";
  }

  // AI/ML
  if (
    n.includes("gemini") ||
    n.includes("openai") ||
    n.includes("rag") ||
    n.includes("prompt") ||
    n.includes("agent")
  ) {
    return "ai";
  }

  // API/Integration
  if (n.includes("api") || n.includes("webhook") || n.includes("n8n") || n.includes("automation")) {
    return "integration";
  }

  return "other";
}

const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
  cloud: { emoji: "☁️", label: "Cloud & DevOps" },
  dev: { emoji: "💻", label: "Development" },
  productivity: { emoji: "📧", label: "Productivity" },
  media: { emoji: "🎬", label: "Media & Files" },
  research: { emoji: "🔍", label: "Search & Research" },
  database: { emoji: "🗄️", label: "Database" },
  business: { emoji: "💼", label: "Business & E-commerce" },
  ai: { emoji: "🤖", label: "AI & ML" },
  integration: { emoji: "🔗", label: "APIs & Integration" },
  other: { emoji: "📦", label: "Other" },
};

function loadSkillsFromDirectory(dir: string, source: string): Skill[] {
  try {
    const loaded = loadSkillsFromDir({ dir, source });
    if (Array.isArray(loaded)) return loaded;
    if (
      loaded &&
      typeof loaded === "object" &&
      "skills" in loaded &&
      Array.isArray((loaded as { skills?: unknown }).skills)
    ) {
      return (loaded as { skills: Skill[] }).skills;
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return [];
}

function truncateDescription(desc: string, maxLen: number = 60): string {
  if (desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen - 1) + "…";
}

function generateSkillsCatalog(): string {
  const bundledDir = resolveBundledSkillsDir();
  if (!bundledDir) {
    console.error("No bundled skills directory found");
    return "# Skills Catalog\n\nNo skills available.\n";
  }
  const skills = loadSkillsFromDirectory(bundledDir, "bundled");

  // Parse frontmatter for each skill
  const entries: SkillCatalogEntry[] = skills.map((skill) => {
    let frontmatter: Record<string, string> = {};
    let metadata: Record<string, unknown> = {};

    try {
      const raw = fs.readFileSync(skill.filePath, "utf-8");
      frontmatter = parseFrontmatter(raw);
      if (frontmatter.metadata) {
        try {
          metadata = JSON.parse(frontmatter.metadata);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    const thinkfleet = (metadata["thinkfleet-engine"] ??
      metadata.thinkfleetbot ??
      metadata.thinkfleet ??
      {}) as Record<string, unknown>;

    return {
      name: skill.name,
      description: truncateDescription(skill.description || frontmatter.description || skill.name),
      category: inferCategory(skill.name, { ...metadata, ...thinkfleet }),
      emoji: (thinkfleet.emoji as string) ?? undefined,
    };
  });

  // Sort by category, then by name
  entries.sort((a, b) => {
    const catCmp = (a.category ?? "").localeCompare(b.category ?? "");
    if (catCmp !== 0) return catCmp;
    return a.name.localeCompare(b.name);
  });

  // Group by category
  const byCategory = new Map<string, SkillCatalogEntry[]>();
  for (const entry of entries) {
    const cat = entry.category || "other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(entry);
  }

  // Generate markdown
  const lines: string[] = [];
  lines.push("# Skills Catalog");
  lines.push("");
  lines.push(`${entries.length} skills available. Read a skill's SKILL.md for detailed usage.`);
  lines.push("");
  lines.push("**To use a skill:** Read `skills/{skill-name}/SKILL.md` for instructions.");
  lines.push("");
  lines.push("---");
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
    "ai",
    "integration",
    "other",
  ];

  for (const cat of categoryOrder) {
    const catEntries = byCategory.get(cat);
    if (!catEntries || catEntries.length === 0) continue;

    const { emoji, label } = CATEGORY_LABELS[cat] || { emoji: "📦", label: cat };
    lines.push(`## ${emoji} ${label}`);
    lines.push("");

    for (const entry of catEntries) {
      const skillEmoji = entry.emoji ? `${entry.emoji} ` : "";
      lines.push(`- **${skillEmoji}${entry.name}** — ${entry.description}`);
    }

    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*This catalog is auto-generated from skill directories.*");
  lines.push("");

  return lines.join("\n");
}

// Main execution
const catalogContent = generateSkillsCatalog();
const outputPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../../docs/reference/templates/SKILLS_CATALOG.md",
);

// Ensure directory exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, catalogContent, "utf-8");

console.log(`Generated: ${outputPath}`);

// Count stats
const lineCount = catalogContent.split("\n").length;
const charCount = catalogContent.length;
console.log(`Lines: ${lineCount}`);
console.log(`Characters: ${charCount} (~${Math.ceil(charCount / 4)} tokens)`);
