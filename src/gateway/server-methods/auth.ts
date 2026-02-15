import { upsertAuthProfile } from "../../agents/auth-profiles/profiles.js";
import {
  clearSaasCredentialCache,
  invalidateSaasCredentialCache,
} from "../../agents/saas-credential-client.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * Gateway RPC handlers for managing auth profiles (API keys).
 * Used by the SaaS backend to hot-push credentials to running containers.
 */
export const authHandlers: GatewayRequestHandlers = {
  /**
   * Invalidate the entire credential cache so the next execution
   * fetches fresh credentials from SaaS.  Called by the SaaS backend
   * after credential saves, deletes, or rotations.
   */
  "credentials.invalidate": async ({ respond }) => {
    clearSaasCredentialCache();
    respond(true, { invalidated: true }, undefined);
  },

  /**
   * Upsert an API key into the agent's auth-profiles.json.
   *
   * Params:
   *   provider  – e.g. "anthropic", "openai"
   *   apiKey    – the raw API key string
   *   profileId – optional profile name (defaults to "<provider>-saas")
   */
  "auth.upsert": async ({ params, respond }) => {
    const provider = (params as Record<string, unknown>)?.provider;
    const apiKey = (params as Record<string, unknown>)?.apiKey;
    const profileId =
      ((params as Record<string, unknown>)?.profileId as string) || `${provider}-saas`;

    if (typeof provider !== "string" || !provider.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "provider is required"));
      return;
    }

    if (typeof apiKey !== "string" || !apiKey.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "apiKey is required"));
      return;
    }

    try {
      upsertAuthProfile({
        profileId,
        credential: {
          type: "api_key",
          provider: provider.trim(),
          key: apiKey.trim(),
        },
      });

      invalidateSaasCredentialCache(provider.trim());
      respond(true, { profileId, provider: provider.trim() }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to upsert auth profile: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  },
};
