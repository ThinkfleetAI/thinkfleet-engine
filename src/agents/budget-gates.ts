/**
 * Budget Gate Registry
 *
 * Allows plugins to register budget enforcement gates that are checked
 * before agent execution. If any gate returns blocked=true, the agent
 * run is skipped with a user-friendly message.
 *
 * The SaaS connector plugin registers a gate that checks the platform
 * token budget. Standalone mode has no gates registered.
 */

export type BudgetGateResult = {
  blocked: true;
  message: string;
};

export type BudgetGate = () => Promise<BudgetGateResult | null>;

const gates: BudgetGate[] = [];

export function registerBudgetGate(gate: BudgetGate): void {
  gates.push(gate);
}

/**
 * Check all registered budget gates.
 * Returns the first blocking result, or null if all gates pass.
 */
export async function checkBudgetGates(): Promise<BudgetGateResult | null> {
  for (const gate of gates) {
    const result = await gate();
    if (result?.blocked) return result;
  }
  return null;
}

/**
 * Returns true if any budget gates are registered.
 */
export function hasBudgetGates(): boolean {
  return gates.length > 0;
}
