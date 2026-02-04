"""
MemU Sidecar — Configuration.

All settings are driven by environment variables with sensible defaults.
When MEMU_LLM_API_KEY is set, LLM-powered features are enabled (extraction,
categorisation, query rewriting, sufficiency checking).  Without an API key
the sidecar degrades gracefully to basic chunking + vector search.
"""

from __future__ import annotations

import os
from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Memory types
# ---------------------------------------------------------------------------

MemoryType = Literal["profile", "event", "knowledge", "behavior", "skill"]

MEMORY_TYPES: list[MemoryType] = ["profile", "event", "knowledge", "behavior", "skill"]

# ---------------------------------------------------------------------------
# Default categories
# ---------------------------------------------------------------------------

DEFAULT_CATEGORIES: list[dict[str, str]] = [
    {"name": "personal_info", "description": "Basic personal information and demographics"},
    {"name": "preferences", "description": "Likes, dislikes, and personal preferences"},
    {"name": "relationships", "description": "People, connections, and social relationships"},
    {"name": "activities", "description": "Hobbies, sports, and regular activities"},
    {"name": "goals", "description": "Aspirations, targets, and future plans"},
    {"name": "experiences", "description": "Past experiences, travel, and life events"},
    {"name": "knowledge", "description": "Domain expertise, skills, and learned information"},
    {"name": "opinions", "description": "Views, beliefs, and stances on topics"},
    {"name": "habits", "description": "Routines, patterns, and regular behaviors"},
    {"name": "work_life", "description": "Career, job, workplace, and professional context"},
]

# ---------------------------------------------------------------------------
# Configuration model
# ---------------------------------------------------------------------------


class MemuConfig(BaseModel):
    """Runtime configuration loaded from environment variables."""

    # Server
    port: int = Field(default=8230)
    data_dir: str = Field(default="/data/memu")
    collection_prefix: str = Field(default="memu")

    # LLM
    llm_base_url: str = Field(default="https://api.openai.com/v1")
    llm_api_key: str = Field(default="")
    llm_chat_model: str = Field(default="gpt-4o-mini")
    llm_embed_model: str = Field(default="text-embedding-3-small")
    llm_embed_dimensions: int = Field(default=256)
    llm_temperature: float = Field(default=0.2)
    llm_max_tokens: int = Field(default=2048)

    # Memorize
    chunk_max_chars: int = Field(default=1000)
    chunk_overlap_chars: int = Field(default=100)
    conversation_segment_min_messages: int = Field(default=10)

    # Retrieve
    retrieve_top_k_categories: int = Field(default=3)
    retrieve_top_k_items: int = Field(default=10)
    retrieve_top_k_resources: int = Field(default=5)

    # Category
    category_summary_target_length: int = Field(default=400)

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_api_key)


def load_config() -> MemuConfig:
    """Build config from environment variables."""
    return MemuConfig(
        port=int(os.environ.get("MEMU_PORT", "8230")),
        data_dir=os.environ.get("MEMU_DATA_DIR", "/data/memu"),
        collection_prefix=os.environ.get("MEMU_COLLECTION_PREFIX", "memu"),
        llm_base_url=os.environ.get("MEMU_LLM_BASE_URL", "https://api.openai.com/v1"),
        llm_api_key=os.environ.get("MEMU_LLM_API_KEY", ""),
        llm_chat_model=os.environ.get("MEMU_LLM_CHAT_MODEL", "gpt-4o-mini"),
        llm_embed_model=os.environ.get("MEMU_LLM_EMBED_MODEL", "text-embedding-3-small"),
        llm_embed_dimensions=int(os.environ.get("MEMU_LLM_EMBED_DIMENSIONS", "256")),
        llm_temperature=float(os.environ.get("MEMU_LLM_TEMPERATURE", "0.2")),
        llm_max_tokens=int(os.environ.get("MEMU_LLM_MAX_TOKENS", "2048")),
        chunk_max_chars=int(os.environ.get("MEMU_CHUNK_MAX_CHARS", "1000")),
        chunk_overlap_chars=int(os.environ.get("MEMU_CHUNK_OVERLAP_CHARS", "100")),
        conversation_segment_min_messages=int(
            os.environ.get("MEMU_CONVERSATION_SEGMENT_MIN_MESSAGES", "10")
        ),
        retrieve_top_k_categories=int(os.environ.get("MEMU_RETRIEVE_TOP_K_CATEGORIES", "3")),
        retrieve_top_k_items=int(os.environ.get("MEMU_RETRIEVE_TOP_K_ITEMS", "10")),
        retrieve_top_k_resources=int(os.environ.get("MEMU_RETRIEVE_TOP_K_RESOURCES", "5")),
        category_summary_target_length=int(
            os.environ.get("MEMU_CATEGORY_SUMMARY_TARGET_LENGTH", "400")
        ),
    )
