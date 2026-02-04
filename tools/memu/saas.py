"""
MemU Sidecar — SaaS Credential Client.

Mirrors the credential-fetching pattern from the main Clawdbot gateway.
When running inside a SaaS-managed pod, fetches LLM API keys from the
SaaS backend instead of requiring them as environment variables.

Credentials are cached in-memory with a 5-minute TTL and re-fetched
automatically when expired.

Required environment variables for SaaS mode:
  THINKFLEET_SAAS_API_URL   — SaaS backend API endpoint
  THINKFLEET_AGENT_DB_ID    — Agent's unique ID in the SaaS database
  THINKFLEET_GATEWAY_TOKEN  — Bearer token for authenticated requests
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)

CACHE_TTL_S = 5 * 60  # 5 minutes
FETCH_TIMEOUT_S = 10

# ---------------------------------------------------------------------------
# SaaS env vars
# ---------------------------------------------------------------------------

_saas_api_url = os.environ.get("THINKFLEET_SAAS_API_URL", "")
_agent_db_id = os.environ.get("THINKFLEET_AGENT_DB_ID", "")
_gateway_token = os.environ.get("THINKFLEET_GATEWAY_TOKEN", "")


def is_saas_mode() -> bool:
    """True if running inside a SaaS-managed container."""
    return bool(_saas_api_url and _agent_db_id and _gateway_token)


# ---------------------------------------------------------------------------
# Credential cache
# ---------------------------------------------------------------------------


@dataclass
class CachedCredential:
    value: str
    source: str  # "platform" or "byok"
    fetched_at: float = 0.0


@dataclass
class CredentialCache:
    credentials: dict[str, CachedCredential] = field(default_factory=dict)
    last_fetch_at: float = 0.0
    budget_exhausted: bool = False


_cache = CredentialCache()


# ---------------------------------------------------------------------------
# Fetch from SaaS
# ---------------------------------------------------------------------------


async def fetch_all_credentials() -> dict[str, CachedCredential]:
    """
    Batch-fetch all credentials from the SaaS backend.
    Returns the cached credentials dict (updated in-place).
    """
    if not is_saas_mode():
        return {}

    # Check if cache is still fresh
    if _cache.credentials and (time.time() - _cache.last_fetch_at) < CACHE_TTL_S:
        return _cache.credentials

    url = f"{_saas_api_url.rstrip('/')}/api/internal/credentials/{_agent_db_id}"
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_S) as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {_gateway_token}"},
            )

        if response.status_code != 200:
            logger.error(
                "[saas-cred] Failed to fetch credentials: %d %s",
                response.status_code,
                response.reason_phrase,
            )
            return _cache.credentials

        data: dict[str, Any] = response.json()
        now = time.time()

        _cache.budget_exhausted = data.get("budgetExhausted", False)
        if _cache.budget_exhausted:
            logger.warning("[saas-cred] Token budget exhausted — platform keys will not be served")

        for cred in data.get("credentials", []):
            provider = cred.get("provider", "")
            value = cred.get("value", "")
            source = cred.get("source", "byok")
            if provider and value:
                _cache.credentials[provider] = CachedCredential(
                    value=value,
                    source=source,
                    fetched_at=now,
                )

        _cache.last_fetch_at = now
        logger.info(
            "[saas-cred] Fetched %d credential(s) from SaaS",
            len(data.get("credentials", [])),
        )

    except Exception as e:
        logger.error("[saas-cred] Error fetching credentials: %s", e)

    return _cache.credentials


async def get_credential(provider: str) -> str | None:
    """
    Get a credential value for a specific provider.
    Fetches from SaaS if needed, returns None if unavailable.
    """
    if not is_saas_mode():
        return None

    # Check cache freshness
    cached = _cache.credentials.get(provider)
    if cached and (time.time() - cached.fetched_at) < CACHE_TTL_S:
        return cached.value

    # Re-fetch all credentials
    await fetch_all_credentials()

    cached = _cache.credentials.get(provider)
    return cached.value if cached else None


async def get_llm_api_key() -> str | None:
    """
    Get the LLM API key from SaaS.
    Tries 'openai' provider first, then 'anthropic', then 'openrouter'.
    """
    for provider in ("openai", "anthropic", "openrouter"):
        key = await get_credential(provider)
        if key:
            logger.info("[saas-cred] Resolved LLM API key from provider=%s", provider)
            return key
    return None


async def get_llm_base_url() -> str | None:
    """
    Get the LLM base URL from SaaS if a non-OpenAI provider is used.
    """
    # Check if we have an openrouter key — use their base URL
    if _cache.credentials.get("openrouter"):
        return "https://openrouter.ai/api/v1"
    return None


def is_budget_exhausted() -> bool:
    """True if the SaaS platform token budget is exhausted."""
    return _cache.budget_exhausted


def invalidate_cache(provider: str | None = None) -> None:
    """Invalidate credential cache (all or specific provider)."""
    if provider:
        _cache.credentials.pop(provider, None)
    else:
        _cache.credentials.clear()
        _cache.last_fetch_at = 0


# ---------------------------------------------------------------------------
# Agent config fetch  (optional — for MemU-specific config from SaaS)
# ---------------------------------------------------------------------------


async def fetch_agent_config() -> dict[str, Any]:
    """
    Fetch agent configuration from SaaS. May contain MemU-specific settings
    like preferred LLM model, embed model, etc.
    """
    if not is_saas_mode():
        return {}

    url = f"{_saas_api_url.rstrip('/')}/api/internal/agent-config/{_agent_db_id}"
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_S) as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {_gateway_token}"},
            )

        if response.status_code != 200:
            logger.warning("[saas-config] Failed to fetch agent config: %d", response.status_code)
            return {}

        data = response.json()
        logger.info("[saas-config] Fetched agent config from SaaS")
        return data

    except Exception as e:
        logger.error("[saas-config] Error fetching agent config: %s", e)
        return {}
