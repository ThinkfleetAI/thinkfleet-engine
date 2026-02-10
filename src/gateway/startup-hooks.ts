/**
 * Gateway Startup Hook Registry
 *
 * Allows plugins to register functions that run during gateway startup,
 * before plugins and channels are loaded. Used by the SaaS connector
 * to apply agent config (name, persona, model settings) from the platform.
 */

export type GatewayStartupHook = (workspaceDir: string) => Promise<void>;

const hooks: GatewayStartupHook[] = [];

export function registerGatewayStartupHook(hook: GatewayStartupHook): void {
  hooks.push(hook);
}

/**
 * Run all registered startup hooks in order.
 */
export async function runGatewayStartupHooks(workspaceDir: string): Promise<void> {
  for (const hook of hooks) {
    await hook(workspaceDir);
  }
}
