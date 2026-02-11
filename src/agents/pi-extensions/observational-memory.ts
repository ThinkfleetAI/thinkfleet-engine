/**
 * Observational Memory extension — replaces observed messages with
 * a compressed observation block for prompt cache efficiency.
 */

export { default } from "./observational-memory/extension.js";

export type { ObservationalMemoryRuntimeValue } from "./observational-memory/runtime.js";
export {
  setObservationalMemoryRuntime,
  getObservationalMemoryRuntime,
} from "./observational-memory/runtime.js";
