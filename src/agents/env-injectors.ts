/**
 * Environment Injector Registry
 *
 * Allows plugins to register functions that inject environment variables
 * before skill/tool execution. Each injector returns a cleanup function
 * that restores the original env state.
 *
 * The SaaS connector plugin registers an injector that fetches credentials
 * from the SaaS backend and sets them as env vars for bash-based skills.
 */

export type EnvInjector = () => Promise<(() => void) | undefined>;

const injectors: EnvInjector[] = [];

export function registerEnvInjector(injector: EnvInjector): void {
  injectors.push(injector);
}

/**
 * Run all registered env injectors and return a combined cleanup function.
 */
export async function injectPluginEnv(): Promise<() => void> {
  const cleanups: (() => void)[] = [];
  for (const injector of injectors) {
    const cleanup = await injector();
    if (cleanup) cleanups.push(cleanup);
  }
  return () => {
    for (const fn of cleanups) fn();
  };
}
