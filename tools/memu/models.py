"""
MemU Sidecar — Data models.

Pydantic models for API request/response payloads and internal data structures.
The hierarchical memory model follows the MemU pattern:

  Resource  →  MemoryItem  →  MemoryCategory
                     ↕
               CategoryItem (junction)
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# API request / response models  (keep compatible with gateway memu-tools.ts)
# ---------------------------------------------------------------------------


class MemorizeRequest(BaseModel):
    content: str
    user_id: str = "default"
    modality: str = "conversation"


class MemorizeResponse(BaseModel):
    ok: bool = True
    stored: int = 0
    user_id: str = "default"
    memory_types: dict[str, int] = {}


class RetrieveRequest(BaseModel):
    query: str
    user_id: str = "default"
    method: str = "rag"
    max_results: int = Field(default=10, ge=1, le=100)


class MemoryItem(BaseModel):
    id: str
    content: str
    score: float
    metadata: dict[str, Any] = {}


class RetrieveResponse(BaseModel):
    ok: bool = True
    items: list[MemoryItem] = []
    method: str = "rag"
    query: str = ""


class StatusResponse(BaseModel):
    ok: bool = True
    uptime_seconds: float = 0
    storage: str = "chromadb"
    data_dir: str = ""
    collections: int = 0
    total_documents: int = 0
    llm_enabled: bool = False
    categories: int = 0


# ---------------------------------------------------------------------------
# CRUD request / response models  (additional management endpoints)
# ---------------------------------------------------------------------------


class ListMemoriesRequest(BaseModel):
    user_id: str = "default"
    memory_type: str | None = None
    category: str | None = None
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class ListMemoriesResponse(BaseModel):
    ok: bool = True
    items: list[MemoryItem] = []
    total: int = 0


class ListCategoriesRequest(BaseModel):
    user_id: str = "default"


class CategoryInfo(BaseModel):
    name: str
    description: str
    summary: str | None = None
    item_count: int = 0


class ListCategoriesResponse(BaseModel):
    ok: bool = True
    categories: list[CategoryInfo] = []


class DeleteMemoryRequest(BaseModel):
    user_id: str = "default"
    memory_type: str | None = None
    category: str | None = None


class DeleteMemoryResponse(BaseModel):
    ok: bool = True
    deleted: int = 0


class CreateMemoryRequest(BaseModel):
    content: str
    user_id: str = "default"
    memory_type: str = "knowledge"
    categories: list[str] = []


class CreateMemoryResponse(BaseModel):
    ok: bool = True
    id: str = ""


# ---------------------------------------------------------------------------
# Internal data structures
# ---------------------------------------------------------------------------

MemoryTypeLiteral = Literal["profile", "event", "knowledge", "behavior", "skill"]


class ExtractedMemory(BaseModel):
    """A single memory item extracted by the LLM from source content."""

    memory_type: str
    summary: str
    categories: list[str] = []


class ConversationSegment(BaseModel):
    """A segment of a conversation identified by the LLM."""

    start_index: int
    end_index: int
    topic: str = ""
