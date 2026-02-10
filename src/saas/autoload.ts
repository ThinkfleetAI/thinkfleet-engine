/**
 * SaaS Connector Autoloader
 *
 * Automatically registers SaaS integration capabilities when SaaS mode
 * env vars are detected. This bridges the existing SaaS code into the
 * engine's pluggable extension points.
 *
 * In the future, this code will move to a separate @thinkfleet/saas-connector
 * plugin package (deployed via the SaaS Docker image). For now, it lives here
 * to maintain backward compatibility with existing SaaS deployments.
 */

import { registerCredentialResolver } from "../agents/credential-resolvers.js";
import { registerBudgetGate } from "../agents/budget-gates.js";
import { registerEnvInjector } from "../agents/env-injectors.js";
import { registerGatewayStartupHook } from "../gateway/startup-hooks.js";

/**
 * Returns true if SaaS mode env vars are set.
 * This is a standalone check that doesn't import the SaaS credential client.
 */
export function isSaasMode(): boolean {
  return !!(
    process.env.THINKFLEET_SAAS_API_URL &&
    process.env.THINKFLEET_AGENT_DB_ID &&
    process.env.THINKFLEET_GATEWAY_TOKEN
  );
}

/**
 * Register all SaaS integration extension points.
 * Called once during gateway startup when SaaS env vars are detected.
 */
export async function autoloadSaasConnector(): Promise<void> {
  const {
    fetchCredentialFromSaas,
    isBudgetExhausted,
    hasByokLlmCredential,
    injectSaasCredentialsToEnv,
  } = await import("../agents/saas-credential-client.js");

  // Credential resolver: fetch API keys from SaaS backend
  registerCredentialResolver(async (provider) => {
    const result = await fetchCredentialFromSaas(provider);
    if (!result) return null;
    return { apiKey: result.apiKey, keySource: result.source };
  });

  // Budget gate: block agent execution when token budget is exhausted
  registerBudgetGate(async () => {
    // Warm the credential cache so isBudgetExhausted() has fresh data
    await fetchCredentialFromSaas("anthropic");
    if (isBudgetExhausted() && !hasByokLlmCredential()) {
      return {
        blocked: true,
        message:
          "Your organization has reached its monthly token limit. Please upgrade your plan, add your own API key, or wait until the next billing period to continue using AI features.",
      };
    }
    return null;
  });

  // Env injector: inject non-LLM credentials as env vars for bash-based skills
  registerEnvInjector(injectSaasCredentialsToEnv);

  // Startup hook: fetch and apply agent config from SaaS platform
  registerGatewayStartupHook(async (workspaceDir) => {
    const { applySaasAgentConfig } = await import("../agents/saas-config-client.js");
    await applySaasAgentConfig(workspaceDir);
  });
}
