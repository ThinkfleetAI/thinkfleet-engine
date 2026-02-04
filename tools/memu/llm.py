"""
MemU Sidecar — LLM Client.

Async OpenAI-compatible client for chat completions and embeddings.
Supports any OpenAI-compatible API (OpenAI, Azure, local models, etc.)
via configurable base URL and API key.

Credential resolution order:
  1. MEMU_LLM_API_KEY environment variable
  2. SaaS backend credential fetch (when in SaaS mode)
"""

from __future__ import annotations

import logging
from typing import Any

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from config import MemuConfig

logger = logging.getLogger(__name__)


class LLMClient:
    """Async wrapper around an OpenAI-compatible API with SaaS credential support."""

    def __init__(self, config: MemuConfig) -> None:
        self.config = config
        self._client: AsyncOpenAI | None = None
        self._enabled: bool | None = None
        # Overridable at runtime (set by SaaS credential fetch)
        self._api_key: str | None = None
        self._base_url: str | None = None

    @property
    def enabled(self) -> bool:
        # If SaaS credentials were loaded, we might be enabled even without env var
        if self._enabled is not None:
            return self._enabled
        return self.config.llm_enabled

    def configure_from_saas(self, api_key: str, base_url: str | None = None) -> None:
        """Apply credentials fetched from SaaS backend at runtime."""
        self._api_key = api_key
        if base_url:
            self._base_url = base_url
        # Invalidate existing client so next call uses new credentials
        self._client = None
        self._enabled = True
        logger.info(
            "LLM configured from SaaS — base_url=%s",
            base_url or self.config.llm_base_url,
        )

    def _resolve_api_key(self) -> str:
        """Resolve the API key: SaaS override → env var config."""
        if self._api_key:
            return self._api_key
        return self.config.llm_api_key

    def _resolve_base_url(self) -> str:
        """Resolve the base URL: SaaS override → env var config."""
        if self._base_url:
            return self._base_url
        return self.config.llm_base_url

    def _get_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=self._resolve_api_key(),
                base_url=self._resolve_base_url(),
            )
        return self._client

    async def chat(
        self,
        system_prompt: str,
        user_content: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Send a chat completion request and return the assistant's text."""
        if not self.enabled:
            raise RuntimeError(
                "LLM not configured — set MEMU_LLM_API_KEY or configure SaaS credentials"
            )

        client = self._get_client()
        messages: list[ChatCompletionMessageParam] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]
        response = await client.chat.completions.create(
            model=self.config.llm_chat_model,
            messages=messages,
            temperature=temperature if temperature is not None else self.config.llm_temperature,
            max_tokens=max_tokens or self.config.llm_max_tokens,
        )
        content = response.choices[0].message.content or ""
        logger.debug("LLM chat response length=%d", len(content))
        return content

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        if not self.enabled:
            raise RuntimeError(
                "LLM not configured — set MEMU_LLM_API_KEY or configure SaaS credentials"
            )
        if not texts:
            return []

        client = self._get_client()
        # Process in batches of 100 to stay within API limits
        all_embeddings: list[list[float]] = []
        batch_size = 100
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            response = await client.embeddings.create(
                model=self.config.llm_embed_model,
                input=batch,
                dimensions=self.config.llm_embed_dimensions,
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)
        return all_embeddings

    async def embed_single(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        results = await self.embed([text])
        return results[0] if results else []
