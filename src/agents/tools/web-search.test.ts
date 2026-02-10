import { afterEach, describe, expect, it } from "vitest";

import { __testing } from "./web-search.js";

const {
  inferPerplexityBaseUrlFromApiKey,
  resolvePerplexityBaseUrl,
  normalizeFreshness,
  resolveSearchProvider,
  resolveExaConfig,
  resolveExaApiKey,
  resolveExaSearchType,
  missingSearchKeyPayload,
} = __testing;

describe("web_search perplexity baseUrl defaults", () => {
  it("detects a Perplexity key prefix", () => {
    expect(inferPerplexityBaseUrlFromApiKey("pplx-123")).toBe("direct");
  });

  it("detects an OpenRouter key prefix", () => {
    expect(inferPerplexityBaseUrlFromApiKey("sk-or-v1-123")).toBe("openrouter");
  });

  it("returns undefined for unknown key formats", () => {
    expect(inferPerplexityBaseUrlFromApiKey("unknown-key")).toBeUndefined();
  });

  it("prefers explicit baseUrl over key-based defaults", () => {
    expect(resolvePerplexityBaseUrl({ baseUrl: "https://example.com" }, "config", "pplx-123")).toBe(
      "https://example.com",
    );
  });

  it("defaults to direct when using PERPLEXITY_API_KEY", () => {
    expect(resolvePerplexityBaseUrl(undefined, "perplexity_env")).toBe("https://api.perplexity.ai");
  });

  it("defaults to OpenRouter when using OPENROUTER_API_KEY", () => {
    expect(resolvePerplexityBaseUrl(undefined, "openrouter_env")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });

  it("defaults to direct when config key looks like Perplexity", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "pplx-123")).toBe(
      "https://api.perplexity.ai",
    );
  });

  it("defaults to OpenRouter when config key looks like OpenRouter", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "sk-or-v1-123")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });

  it("defaults to OpenRouter for unknown config key formats", () => {
    expect(resolvePerplexityBaseUrl(undefined, "config", "weird-key")).toBe(
      "https://openrouter.ai/api/v1",
    );
  });
});

describe("web_search freshness normalization", () => {
  it("accepts Brave shortcut values", () => {
    expect(normalizeFreshness("pd")).toBe("pd");
    expect(normalizeFreshness("PW")).toBe("pw");
  });

  it("accepts valid date ranges", () => {
    expect(normalizeFreshness("2024-01-01to2024-01-31")).toBe("2024-01-01to2024-01-31");
  });

  it("rejects invalid date ranges", () => {
    expect(normalizeFreshness("2024-13-01to2024-01-31")).toBeUndefined();
    expect(normalizeFreshness("2024-02-30to2024-03-01")).toBeUndefined();
    expect(normalizeFreshness("2024-03-10to2024-03-01")).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  Exa provider resolution                                                    */
/* -------------------------------------------------------------------------- */

describe("web_search Exa provider resolution", () => {
  it("resolves 'exa' provider from config", () => {
    expect(resolveSearchProvider({ provider: "exa" } as any)).toBe("exa");
  });

  it("resolves 'exa' case-insensitively", () => {
    expect(resolveSearchProvider({ provider: "EXA" } as any)).toBe("exa");
    expect(resolveSearchProvider({ provider: "Exa" } as any)).toBe("exa");
  });

  it("still resolves other providers correctly", () => {
    expect(resolveSearchProvider({ provider: "brave" } as any)).toBe("brave");
    expect(resolveSearchProvider({ provider: "perplexity" } as any)).toBe("perplexity");
  });

  it("defaults to brave when no provider set", () => {
    expect(resolveSearchProvider(undefined)).toBe("brave");
    expect(resolveSearchProvider({} as any)).toBe("brave");
  });
});

describe("web_search Exa config resolution", () => {
  it("returns empty config for undefined search", () => {
    expect(resolveExaConfig(undefined)).toEqual({});
  });

  it("returns empty config when no exa block present", () => {
    expect(resolveExaConfig({ provider: "exa" } as any)).toEqual({});
  });

  it("extracts exa config from search config", () => {
    const search = { exa: { apiKey: "key-123", searchType: "neural" } };
    expect(resolveExaConfig(search as any)).toEqual({ apiKey: "key-123", searchType: "neural" });
  });
});

describe("web_search Exa API key resolution", () => {
  const priorEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...priorEnv };
  });

  it("prefers config apiKey over env", () => {
    process.env.EXA_API_KEY = "env-key";
    expect(resolveExaApiKey({ apiKey: "config-key" })).toBe("config-key");
  });

  it("falls back to EXA_API_KEY env var", () => {
    process.env.EXA_API_KEY = "env-key";
    expect(resolveExaApiKey({})).toBe("env-key");
    expect(resolveExaApiKey(undefined)).toBe("env-key");
  });

  it("returns undefined when no key available", () => {
    delete process.env.EXA_API_KEY;
    expect(resolveExaApiKey(undefined)).toBeUndefined();
    expect(resolveExaApiKey({})).toBeUndefined();
  });

  it("trims whitespace from keys", () => {
    expect(resolveExaApiKey({ apiKey: "  key-with-spaces  " })).toBe("key-with-spaces");
  });

  it("returns undefined for empty string key", () => {
    expect(resolveExaApiKey({ apiKey: "  " })).toBeUndefined();
  });
});

describe("web_search Exa search type resolution", () => {
  it("defaults to 'auto'", () => {
    expect(resolveExaSearchType(undefined)).toBe("auto");
    expect(resolveExaSearchType({})).toBe("auto");
  });

  it("uses configured search type", () => {
    expect(resolveExaSearchType({ searchType: "neural" })).toBe("neural");
    expect(resolveExaSearchType({ searchType: "deep" })).toBe("deep");
  });
});

describe("web_search missing key payload", () => {
  it("returns exa-specific error for exa provider", () => {
    const payload = missingSearchKeyPayload("exa");
    expect(payload.error).toBe("missing_exa_api_key");
    expect(payload.message).toContain("EXA_API_KEY");
  });

  it("returns brave error for brave provider", () => {
    const payload = missingSearchKeyPayload("brave");
    expect(payload.error).toBe("missing_brave_api_key");
  });

  it("returns perplexity error for perplexity provider", () => {
    const payload = missingSearchKeyPayload("perplexity");
    expect(payload.error).toBe("missing_perplexity_api_key");
  });
});
