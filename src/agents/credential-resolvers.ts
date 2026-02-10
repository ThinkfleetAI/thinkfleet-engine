/**
 * Credential Resolver Registry
 *
 * Allows plugins to register credential resolvers that are tried before
 * the engine's built-in resolution chain (env vars, auth profiles, config).
 *
 * The SaaS connector plugin registers a resolver that fetches credentials
 * from the SaaS backend. Standalone mode has no resolvers registered,
 * so the engine falls through to local credential sources.
 */

export type KeySource = "platform" | "byok";

export type CredentialResolverResult = {
  apiKey: string;
  keySource: KeySource;
};

export type CredentialResolver = (provider: string) => Promise<CredentialResolverResult | null>;

const resolvers: CredentialResolver[] = [];

export function registerCredentialResolver(resolver: CredentialResolver): void {
  resolvers.push(resolver);
}

/**
 * Try all registered credential resolvers in order.
 * Returns the first successful result, or null if none match.
 */
export async function resolvePluginCredential(
  provider: string,
): Promise<CredentialResolverResult | null> {
  for (const resolver of resolvers) {
    const result = await resolver(provider);
    if (result) return result;
  }
  return null;
}

/**
 * Returns true if any credential resolvers are registered.
 * Useful for skipping resolver calls when no plugins are loaded.
 */
export function hasCredentialResolvers(): boolean {
  return resolvers.length > 0;
}
