/**
 * SaaS Credential Client
 *
 * When running inside a SaaS-managed container, fetches API keys from the
 * SaaS backend on demand instead of reading from env vars or disk.
 *
 * Credentials are cached in-memory only (never persisted to disk).
 * The cache is invalidated when auth.upsert pushes a new credential.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedCredential {
  value: string;
  fetchedAt: number;
}

interface CredentialResponse {
  credentials: Array<{
    provider: string;
    type: string;
    value: string;
  }>;
}

// In-memory cache: provider → { value, fetchedAt }
const cache = new Map<string, CachedCredential>();

// All credentials fetched in a single request, keyed by provider
let allCredentials: Map<string, string> | null = null;
let lastFetchAt = 0;

const saasApiUrl = process.env.CLAWDBOT_SAAS_API_URL;
const agentDbId = process.env.CLAWDBOT_AGENT_DB_ID;
const gatewayToken = process.env.CLAWDBOT_GATEWAY_TOKEN;

/**
 * Returns true if running in SaaS mode (env vars are set).
 */
export function isSaasMode(): boolean {
  return !!(saasApiUrl && agentDbId && gatewayToken);
}

/**
 * Fetch a credential for a specific provider from the SaaS backend.
 * Returns null if not in SaaS mode or if no credential exists for the provider.
 */
export async function fetchCredentialFromSaas(
  provider: string,
): Promise<{ apiKey: string } | null> {
  if (!isSaasMode()) return null;

  // Check cache
  const cached = cache.get(provider);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { apiKey: cached.value };
  }

  // Fetch all credentials from SaaS (batch request)
  if (!allCredentials || Date.now() - lastFetchAt >= CACHE_TTL_MS) {
    try {
      const url = `${saasApiUrl}/api/internal/credentials/${agentDbId}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${gatewayToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.error(
          `[saas-cred] Failed to fetch credentials: ${response.status} ${response.statusText}`,
        );
        // Fall through to existing resolution chain
        return null;
      }

      const data = (await response.json()) as CredentialResponse;
      allCredentials = new Map<string, string>();

      for (const cred of data.credentials) {
        allCredentials.set(cred.provider, cred.value);
        cache.set(cred.provider, {
          value: cred.value,
          fetchedAt: Date.now(),
        });
      }

      lastFetchAt = Date.now();
    } catch (error) {
      console.error("[saas-cred] Error fetching credentials:", error);
      return null;
    }
  }

  const value = cache.get(provider);
  if (value) {
    return { apiKey: value.value };
  }

  return null;
}

/**
 * Invalidate cache for a specific provider (called when auth.upsert pushes a new key).
 */
export function invalidateSaasCredentialCache(provider: string): void {
  cache.delete(provider);
  allCredentials = null;
}

/**
 * Clear all cached credentials.
 */
export function clearSaasCredentialCache(): void {
  cache.clear();
  allCredentials = null;
  lastFetchAt = 0;
}
