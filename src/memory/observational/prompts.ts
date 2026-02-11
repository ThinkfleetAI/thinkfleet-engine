/**
 * LLM prompts and parsers for the Observer and Reflector agents.
 */

import type { Observation } from "./types.js";

const CHARS_PER_TOKEN_ESTIMATE = 4;

export const OBSERVER_SYSTEM_PROMPT = `\
You are a conversation observer. Your job is to compress a segment of conversation history into dense, information-rich observations.

Rules:
- Produce 3-10 observation entries, each capturing a distinct topic, decision, or state change.
- Each observation should be self-contained and understandable without the original messages.
- Preserve: decisions made, facts established, technical details, action items, user preferences, errors encountered and how they were resolved.
- Drop: greetings, filler, repeated attempts, verbose tool output details, routine acknowledgments.
- Use present tense for current state, past tense for completed actions.
- Include code identifiers, file paths, and specific values when they matter.
- Assign a priority 1-10 (10 = critical decision/blocker, 1 = minor detail).
- Keep each observation under 100 words.

Output format — one observation per block inside <observations> tags:
<observations>
<obs priority="8">
The user is building a REST API with Express and TypeScript. The project uses PostgreSQL with Prisma ORM. The main entities are User, Project, and Task.
</obs>
<obs priority="6">
Authentication was implemented using JWT tokens with refresh token rotation. The access token TTL is 15 minutes, refresh token is 7 days.
</obs>
</observations>

If no meaningful observations can be extracted, output:
<observations>
</observations>`;

export const REFLECTOR_SYSTEM_PROMPT = `\
You are a conversation reflector. You receive a set of observations from an ongoing conversation and must compress them into fewer, higher-level observations.

Rules:
- Merge related observations into broader themes.
- Preserve all critical decisions and technical details.
- Drop observations that are now superseded by later ones.
- Prioritize: active goals > established facts > historical context.
- Keep the most recent state when observations conflict.
- Target 40-60% compression ratio (output should be roughly half the input).
- Maintain priority ratings; boost priorities for items that recur across multiple observations.

Output format (same as observer):
<observations>
<obs priority="9">
...merged/compressed observation...
</obs>
</observations>`;

/**
 * Parse `<observations><obs priority="N">...</obs></observations>` output
 * from Observer/Reflector LLM calls.
 */
export function parseObservations(
  response: string,
  base: {
    sessionKey: string;
    messageStartIndex: number;
    messageEndIndex: number;
    generation: number;
  },
): Omit<Observation, "id">[] {
  const outerMatch = response.match(/<observations>([\s\S]*?)<\/observations>/);
  if (!outerMatch?.[1]) return [];

  const inner = outerMatch[1];
  const obsPattern = /<obs\s+priority="(\d+)">([\s\S]*?)<\/obs>/g;
  const results: Omit<Observation, "id">[] = [];

  let match: RegExpExecArray | null;
  while ((match = obsPattern.exec(inner)) !== null) {
    const priority = Math.max(1, Math.min(10, parseInt(match[1], 10) || 5));
    const content = match[2].trim();
    if (!content) continue;

    results.push({
      sessionKey: base.sessionKey,
      content,
      createdAt: Date.now(),
      messageStartIndex: base.messageStartIndex,
      messageEndIndex: base.messageEndIndex,
      tokenEstimate: Math.ceil(content.length / CHARS_PER_TOKEN_ESTIMATE),
      generation: base.generation,
      priority,
    });
  }

  return results;
}
