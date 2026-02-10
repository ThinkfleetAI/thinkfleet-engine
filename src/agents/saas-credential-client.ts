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

/**
 * Maps SaaS provider strings → environment variable names that skills expect.
 * Only non-LLM credentials are listed here (LLM keys are resolved via model-auth.ts).
 */
const PROVIDER_TO_ENV: Record<string, string> = {
  // Cloud Providers
  aws: "AWS_ACCESS_KEY_ID",
  "aws-secret": "AWS_SECRET_ACCESS_KEY",
  "aws-region": "AWS_DEFAULT_REGION",
  "azure-client-id": "AZURE_CLIENT_ID",
  "azure-client-secret": "AZURE_CLIENT_SECRET",
  "azure-tenant-id": "AZURE_TENANT_ID",
  "azure-subscription-id": "AZURE_SUBSCRIPTION_ID",
  "google-access-token": "GOOGLE_ACCESS_TOKEN",
  // DevOps & CI/CD
  github: "GITHUB_TOKEN",
  gitlab: "GITLAB_TOKEN",
  "gitlab-url": "GITLAB_URL",
  "jira-base-url": "JIRA_BASE_URL",
  "jira-email": "JIRA_EMAIL",
  "jira-api-token": "JIRA_API_TOKEN",
  "azdo-org-url": "AZDO_ORG_URL",
  "azdo-pat": "AZDO_PAT",
  "jenkins-url": "JENKINS_URL",
  "jenkins-user": "JENKINS_USER",
  "jenkins-token": "JENKINS_TOKEN",
  "argocd-server": "ARGOCD_SERVER",
  "argocd-token": "ARGOCD_TOKEN",
  // Monitoring & Observability
  "datadog-api-key": "DATADOG_API_KEY",
  "datadog-app-key": "DATADOG_APP_KEY",
  pagerduty: "PAGERDUTY_TOKEN",
  "grafana-url": "GRAFANA_URL",
  "grafana-token": "GRAFANA_TOKEN",
  // Messaging & Collaboration
  "slack-webhook-url": "SLACK_WEBHOOK_URL",
  "discord-webhook-url": "DISCORD_WEBHOOK_URL",
  "ms-graph-token": "MS_GRAPH_TOKEN",
  // Storage & Databases
  "redis-url": "REDIS_URL",
  "s3-endpoint": "S3_ENDPOINT",
  "s3-bucket": "S3_BUCKET",
  "ses-from-email": "SES_FROM_EMAIL",
  // Voice & TTS
  elevenlabs: "ELEVENLABS_API_KEY",
  deepgram: "DEEPGRAM_API_KEY",
  // Search
  brave: "BRAVE_API_KEY",
  exa: "EXA_API_KEY",
  // E-Commerce
  "shopify-store-url": "SHOPIFY_STORE_URL",
  "shopify-access-token": "SHOPIFY_ACCESS_TOKEN",
  "woocommerce-url": "WOOCOMMERCE_URL",
  "woocommerce-key": "WOOCOMMERCE_KEY",
  "woocommerce-secret": "WOOCOMMERCE_SECRET",
  "bigcommerce-store-hash": "BIGCOMMERCE_STORE_HASH",
  "bigcommerce-access-token": "BIGCOMMERCE_ACCESS_TOKEN",
  "stripe-secret-key": "STRIPE_SECRET_KEY",
  "paypal-client-id": "PAYPAL_CLIENT_ID",
  "paypal-client-secret": "PAYPAL_CLIENT_SECRET",
  // CRM & Sales
  "salesforce-instance-url": "SALESFORCE_INSTANCE_URL",
  "salesforce-access-token": "SALESFORCE_ACCESS_TOKEN",
  "hubspot-access-token": "HUBSPOT_ACCESS_TOKEN",
  "pipedrive-api-token": "PIPEDRIVE_API_TOKEN",
  "pipedrive-domain": "PIPEDRIVE_DOMAIN",
  "zoho-access-token": "ZOHO_ACCESS_TOKEN",
  "zoho-api-domain": "ZOHO_API_DOMAIN",
  "freshdesk-domain": "FRESHDESK_DOMAIN",
  "freshdesk-api-key": "FRESHDESK_API_KEY",
  // Accounting & ERP
  "quickbooks-access-token": "QUICKBOOKS_ACCESS_TOKEN",
  "quickbooks-realm-id": "QUICKBOOKS_REALM_ID",
  "xero-access-token": "XERO_ACCESS_TOKEN",
  "xero-tenant-id": "XERO_TENANT_ID",
  "sap-base-url": "SAP_BASE_URL",
  "sap-api-key": "SAP_API_KEY",
  "netsuite-account-id": "NETSUITE_ACCOUNT_ID",
  "netsuite-token-id": "NETSUITE_TOKEN_ID",
  "netsuite-token-secret": "NETSUITE_TOKEN_SECRET",
  // Marketing & Social
  "twitter-bearer-token": "TWITTER_BEARER_TOKEN",
  "facebook-access-token": "FACEBOOK_ACCESS_TOKEN",
  "linkedin-access-token": "LINKEDIN_ACCESS_TOKEN",
  "mailchimp-api-key": "MAILCHIMP_API_KEY",
  "mailchimp-server-prefix": "MAILCHIMP_SERVER_PREFIX",
  "sendgrid-api-key": "SENDGRID_API_KEY",
  // Project Management
  "asana-access-token": "ASANA_ACCESS_TOKEN",
  "trello-api-key": "TRELLO_API_KEY",
  "trello-token": "TRELLO_TOKEN",
  "linear-api-key": "LINEAR_API_KEY",
  "monday-api-token": "MONDAY_API_TOKEN",
  "notion-api-key": "NOTION_API_KEY",
  "airtable-access-token": "AIRTABLE_ACCESS_TOKEN",
  // Support & Ticketing
  "zendesk-subdomain": "ZENDESK_SUBDOMAIN",
  "zendesk-email": "ZENDESK_EMAIL",
  "zendesk-api-token": "ZENDESK_API_TOKEN",
  "servicenow-instance": "SERVICENOW_INSTANCE",
  "servicenow-user": "SERVICENOW_USER",
  "servicenow-password": "SERVICENOW_PASSWORD",
  // Communication
  "twilio-account-sid": "TWILIO_ACCOUNT_SID",
  "twilio-auth-token": "TWILIO_AUTH_TOKEN",
  "whatsapp-access-token": "WHATSAPP_ACCESS_TOKEN",
  "whatsapp-phone-id": "WHATSAPP_PHONE_ID",
  "telegram-bot-token": "TELEGRAM_BOT_TOKEN",
  // Vector Databases
  "pinecone-api-key": "PINECONE_API_KEY",
  "pinecone-index-url": "PINECONE_INDEX_URL",
  "weaviate-url": "WEAVIATE_URL",
  "weaviate-api-key": "WEAVIATE_API_KEY",
  "qdrant-url": "QDRANT_URL",
  "qdrant-api-key": "QDRANT_API_KEY",
  // Data & Analytics
  "elasticsearch-url": "ELASTICSEARCH_URL",
  "mongodb-uri": "MONGODB_URI",
  "snowflake-account": "SNOWFLAKE_ACCOUNT",
  "snowflake-user": "SNOWFLAKE_USER",
  "snowflake-password": "SNOWFLAKE_PASSWORD",
  "supabase-url": "SUPABASE_URL",
  "supabase-service-key": "SUPABASE_SERVICE_KEY",
  // Infrastructure
  "cloudflare-api-token": "CLOUDFLARE_API_TOKEN",
  "firebase-project-id": "FIREBASE_PROJECT_ID",
  "twitch-client-id": "TWITCH_CLIENT_ID",
  "twitch-access-token": "TWITCH_ACCESS_TOKEN",
};

export type KeySource = "platform" | "byok";

interface CachedCredential {
  value: string;
  source: KeySource;
  fetchedAt: number;
}

interface CredentialResponse {
  credentials: Array<{
    provider: string;
    type: string;
    value: string;
    source?: KeySource;
  }>;
  budgetExhausted?: boolean;
  searchBudgetExhausted?: boolean;
}

// In-memory cache: provider → { value, source, fetchedAt }
const cache = new Map<string, CachedCredential>();

// All credentials fetched in a single request, keyed by provider
let allCredentials: Map<string, { value: string; source: KeySource }> | null = null;
let lastFetchAt = 0;
let _budgetExhausted = false;
let _searchBudgetExhausted = false;

const saasApiUrl = process.env.THINKFLEET_SAAS_API_URL;
const agentDbId = process.env.THINKFLEET_AGENT_DB_ID;
const gatewayToken = process.env.THINKFLEET_GATEWAY_TOKEN;

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
): Promise<{ apiKey: string; source: KeySource } | null> {
  if (!isSaasMode()) return null;

  // Check cache
  const cached = cache.get(provider);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { apiKey: cached.value, source: cached.source };
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
      allCredentials = new Map<string, { value: string; source: KeySource }>();
      _budgetExhausted = data.budgetExhausted ?? false;
      _searchBudgetExhausted = data.searchBudgetExhausted ?? false;

      if (_budgetExhausted) {
        console.warn("[saas-cred] Token budget exhausted — platform keys will not be served");
      }
      if (_searchBudgetExhausted) {
        console.warn(
          "[saas-cred] Search budget exhausted — platform search keys will not be served",
        );
      }

      for (const cred of data.credentials) {
        const source = cred.source ?? "byok";
        allCredentials.set(cred.provider, { value: cred.value, source });
        cache.set(cred.provider, {
          value: cred.value,
          source,
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
    return { apiKey: value.value, source: value.source };
  }

  return null;
}

/**
 * Get the key source for a cached provider credential.
 */
export function getKeySource(provider: string): KeySource | null {
  const cached = cache.get(provider);
  return cached?.source ?? null;
}

/**
 * Returns true if the platform token budget is exhausted.
 */
export function isBudgetExhausted(): boolean {
  return _budgetExhausted;
}

/**
 * Returns true if the platform search budget is exhausted.
 */
export function isSearchBudgetExhausted(): boolean {
  return _searchBudgetExhausted;
}

const LLM_PROVIDERS = new Set([
  "anthropic",
  "openai",
  "google",
  "groq",
  "mistral",
  "openrouter",
  "xai",
  "deepseek",
  "perplexity",
]);

/**
 * Returns true if the cache contains at least one BYOK credential for an LLM provider.
 * Used to allow BYOK users to bypass the platform budget gate.
 */
export function hasByokLlmCredential(): boolean {
  for (const [provider, entry] of cache) {
    if (entry.source === "byok" && LLM_PROVIDERS.has(provider)) return true;
  }
  return false;
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

/**
 * Fetch all SaaS credentials and inject non-LLM ones into process.env
 * so bash-based skills can access them (e.g. JIRA_BASE_URL, GRAFANA_TOKEN).
 *
 * Returns a restore function that removes injected env vars.
 * No-op if not in SaaS mode or if fetch fails.
 */
export async function injectSaasCredentialsToEnv(): Promise<() => void> {
  if (!isSaasMode()) return () => {};

  try {
    const url = `${saasApiUrl}/api/internal/credentials/${agentDbId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${gatewayToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(
        `[saas-cred] Failed to fetch credentials for env injection: ${response.status}`,
      );
      return () => {};
    }

    const data = (await response.json()) as CredentialResponse;
    const injected: Array<{ key: string; prev: string | undefined }> = [];

    for (const cred of data.credentials) {
      // Update cache while we're at it
      const source = cred.source ?? "byok";
      cache.set(cred.provider, { value: cred.value, source, fetchedAt: Date.now() });

      const envVar = PROVIDER_TO_ENV[cred.provider];
      if (!envVar) continue;
      // Don't overwrite existing env vars
      if (process.env[envVar]) continue;

      injected.push({ key: envVar, prev: process.env[envVar] });
      process.env[envVar] = cred.value;
    }

    allCredentials = new Map(
      data.credentials.map((c) => [
        c.provider,
        { value: c.value, source: (c.source ?? "byok") as KeySource },
      ]),
    );
    lastFetchAt = Date.now();

    if (injected.length > 0) {
      console.log(
        `[saas-cred] Injected ${injected.length} credential(s) into env: ${injected.map((i) => i.key).join(", ")}`,
      );
    }

    return () => {
      for (const entry of injected) {
        if (entry.prev === undefined) delete process.env[entry.key];
        else process.env[entry.key] = entry.prev;
      }
    };
  } catch (error) {
    console.error("[saas-cred] Error injecting credentials to env:", error);
    return () => {};
  }
}
