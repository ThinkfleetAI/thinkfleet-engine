import type { ObservationStore } from "../../../memory/observational/store.js";
import type { ObservationalWorkerHandle } from "../../../memory/observational/types.js";

export type ObservationalMemoryRuntimeValue = {
  store: ObservationStore;
  sessionKey: string;
  maxObservationRatio: number;
  workerHandle?: ObservationalWorkerHandle;
};

// Session-scoped runtime registry keyed by object identity.
// Same pattern as context-pruning/runtime.ts.
const REGISTRY = new WeakMap<object, ObservationalMemoryRuntimeValue>();

export function setObservationalMemoryRuntime(
  sessionManager: unknown,
  value: ObservationalMemoryRuntimeValue | null,
): void {
  if (!sessionManager || typeof sessionManager !== "object") {
    return;
  }

  const key = sessionManager as object;
  if (value === null) {
    const prev = REGISTRY.get(key);
    if (prev?.workerHandle) {
      prev.workerHandle.stop();
    }
    if (prev?.store) {
      prev.store.close();
    }
    REGISTRY.delete(key);
    return;
  }

  REGISTRY.set(key, value);
}

export function getObservationalMemoryRuntime(
  sessionManager: unknown,
): ObservationalMemoryRuntimeValue | null {
  if (!sessionManager || typeof sessionManager !== "object") {
    return null;
  }

  return REGISTRY.get(sessionManager as object) ?? null;
}
