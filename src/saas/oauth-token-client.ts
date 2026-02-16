/**
 * OAuth Token Client (Client Credentials Flow)
 *
 * When running as a SaaS-managed container with OAuth enabled, this module
 * exchanges client credentials for short-lived JWT access tokens.
 *
 * Token lifecycle:
 * 1. On first API call, exchanges client_id + client_secret for a JWT
 * 2. Caches the JWT in-memory (never persisted to disk)
 * 3. Proactively refreshes 2 minutes before expiry
 */

const REFRESH_BUFFER_MS = 2 * 60 * 1000; // Refresh 2 min before expiry

// ─── Configuration ──────────────────────────────────────────────────────

const oauthClientId = process.env.THINKFLEET_OAUTH_CLIENT_ID;
const oauthClientSecret = process.env.THINKFLEET_OAUTH_CLIENT_SECRET;
const oauthTokenUrl =
  process.env.THINKFLEET_OAUTH_TOKEN_URL ||
  (process.env.THINKFLEET_SAAS_API_URL
    ? `${process.env.THINKFLEET_SAAS_API_URL}/api/internal/oauth/token`
    : "");
// ─── Token Cache ────────────────────────────────────────────────────────

let cachedToken: {
  accessToken: string;
  expiresAt: number; // Unix ms
} | null = null;

let tokenFetchPromise: Promise<string> | null = null;

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Check if OAuth client credentials are configured.
 */
export function isOAuthConfigured(): boolean {
  return !!(oauthClientId && oauthClientSecret && oauthTokenUrl);
}

/**
 * Get a valid access token for SaaS API calls.
 *
 * Returns a short-lived JWT (refreshed automatically).
 * Requires OAuth to be configured via THINKFLEET_OAUTH_CLIENT_ID and THINKFLEET_OAUTH_CLIENT_SECRET.
 */
export async function getAccessToken(): Promise<string> {
  if (!isOAuthConfigured()) {
    return "";
  }

  // Return cached token if still valid (with buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return cachedToken.accessToken;
  }

  // Deduplicate concurrent token requests
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  tokenFetchPromise = fetchAccessToken();
  try {
    const token = await tokenFetchPromise;
    return token;
  } finally {
    tokenFetchPromise = null;
  }
}

/**
 * Invalidate the cached token (e.g., after receiving a 401 response).
 */
export function invalidateAccessToken(): void {
  cachedToken = null;
}

// ─── Token Exchange ─────────────────────────────────────────────────────

async function fetchAccessToken(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(oauthTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: oauthClientId!,
        client_secret: oauthClientSecret!,
      }).toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`[oauth] Token exchange failed: ${response.status} ${errorBody}`);
      throw new Error(`OAuth token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    console.log(`[oauth] Token obtained, expires_in=${data.expires_in}s, scope=${data.scope}`);

    return data.access_token;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error("[oauth] Token exchange timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
