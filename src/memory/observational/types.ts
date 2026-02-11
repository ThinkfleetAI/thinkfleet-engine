/**
 * Observational Memory types.
 *
 * Two-agent compression system (Observer + Reflector) that compresses
 * conversation history into dense observations for prompt caching and
 * context efficiency.
 */

export type Observation = {
  id: string;
  sessionKey: string;
  content: string;
  createdAt: number;
  /** First message index covered (inclusive). */
  messageStartIndex: number;
  /** Last message index covered (exclusive). */
  messageEndIndex: number;
  /** Estimated token count of this observation. */
  tokenEstimate: number;
  /** 0 = from Observer (messages→obs), 1+ = from Reflector (obs→meta-obs). */
  generation: number;
  /** 1-10 priority for Reflector triage. */
  priority: number;
};

export type ObservationalMemoryConfig = {
  enabled?: boolean;
  /** LLM provider for Observer/Reflector calls (default: "openai"). */
  provider?: string;
  /** LLM model for Observer/Reflector calls (default: "gpt-4o-mini"). */
  model?: string;
  /** Token threshold for triggering Observer on raw messages (default: 30000). */
  observerThresholdTokens?: number;
  /** Token threshold for triggering Reflector on observations (default: 40000). */
  reflectorThresholdTokens?: number;
  /** Debounce interval in ms before running Observer (default: 10000). */
  debounceMs?: number;
  /** Maximum observation block as fraction of context window (default: 0.4). */
  maxObservationRatio?: number;
};

export type ResolvedObservationalConfig = {
  enabled: true;
  provider: string;
  model: string;
  observerThresholdTokens: number;
  reflectorThresholdTokens: number;
  debounceMs: number;
  maxObservationRatio: number;
};

export type ObservationalWorkerHandle = {
  stop: () => void;
};
