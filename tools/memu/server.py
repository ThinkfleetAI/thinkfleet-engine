"""
MemU — Hierarchical Memory Sidecar for ThinkFleet agents.

A sophisticated memory service implementing the MemU architecture:
  - LLM-powered extraction of 5 memory types (profile, event, knowledge, behavior, skill)
  - Hierarchical storage: Resources → MemoryItems → Categories
  - Dual-mode retrieval: RAG (vector similarity) and LLM (deep ranking)
  - Automatic category management with LLM-generated summaries
  - CRUD operations for memory management

REST endpoints consumed by the gateway's memu-tools:
  POST /memorize   — ingest content into hierarchical memory
  POST /retrieve   — query memory via vector similarity or LLM ranking
  GET  /status     — health check and memory statistics
  GET  /health     — simple health probe

Additional CRUD endpoints:
  POST /memories/list       — list memory items with filtering
  POST /memories/create     — manually create a memory item
  POST /memories/delete     — bulk delete memories
  POST /categories/list     — list categories with stats

Storage is backed by ChromaDB (SQLite + HNSW vectors) persisted to
/data/memu inside the container so memories survive restarts.

LLM-powered features activate when an API key is available:
  - MEMU_LLM_API_KEY environment variable, or
  - SaaS backend credential fetch (THINKFLEET_SAAS_API_URL set)

Features enabled with LLM:
  - Memory extraction with 5 types
  - Conversation segmentation and document condensing
  - Automatic categorisation into 10 default categories
  - Category summary generation
  - Query rewriting and sufficiency checking
  - LLM-powered retrieval ranking

Without an LLM API key, the sidecar degrades gracefully to basic
chunking + ChromaDB default embeddings.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import chromadb
from fastapi import FastAPI, HTTPException

from config import MemuConfig, load_config
from llm import LLMClient
from memorize import (
    chunk_text,
    deterministic_id,
    ensure_categories,
    get_categories_collection,
    get_items_collection,
    get_resources_collection,
    memorize_pipeline,
)
from models import (
    CategoryInfo,
    CreateMemoryRequest,
    CreateMemoryResponse,
    DeleteMemoryRequest,
    DeleteMemoryResponse,
    ListCategoriesRequest,
    ListCategoriesResponse,
    ListMemoriesRequest,
    ListMemoriesResponse,
    MemorizeRequest,
    MemorizeResponse,
    MemoryItem,
    RetrieveRequest,
    RetrieveResponse,
    StatusResponse,
)
from retrieve import retrieve_pipeline
from saas import fetch_agent_config, get_llm_api_key, get_llm_base_url, is_saas_mode

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger("memu")

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

config = load_config()
os.makedirs(config.data_dir, exist_ok=True)

chroma = chromadb.PersistentClient(path=config.data_dir)
llm = LLMClient(config)

_startup_time = time.time()

logger.info("MemU sidecar starting — data_dir=%s llm_enabled=%s", config.data_dir, llm.enabled)
logger.info("SaaS mode: %s", is_saas_mode())
if llm.enabled:
    logger.info(
        "LLM config — model=%s embed=%s base_url=%s",
        config.llm_chat_model,
        config.llm_embed_model,
        config.llm_base_url,
    )

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="MemU Hierarchical Memory Sidecar",
    version="2.0.0",
    description="Hierarchical memory service with LLM-powered extraction and retrieval.",
)


@app.on_event("startup")
async def _startup_fetch_saas_credentials() -> None:
    """On startup, fetch LLM credentials from SaaS backend if available."""
    if not is_saas_mode():
        if not llm.enabled:
            logger.warning(
                "No LLM API key configured — running in basic mode. "
                "Set MEMU_LLM_API_KEY or configure SaaS credentials."
            )
        return

    logger.info("SaaS mode detected — fetching LLM credentials from platform...")
    try:
        api_key = await get_llm_api_key()
        if api_key:
            base_url = await get_llm_base_url()
            llm.configure_from_saas(api_key, base_url)
            logger.info("LLM credentials loaded from SaaS — LLM features enabled")
        else:
            logger.warning(
                "No LLM credentials found in SaaS — "
                "falling back to env var (MEMU_LLM_API_KEY=%s)",
                "set" if config.llm_api_key else "not set",
            )
    except Exception as e:
        logger.error("Failed to fetch SaaS credentials: %s", e)

    # Also fetch agent config for any MemU-specific overrides
    try:
        agent_config = await fetch_agent_config()
        if agent_config:
            logger.info("Agent config loaded from SaaS: %s", list(agent_config.keys()))
    except Exception as e:
        logger.debug("Agent config fetch failed (non-critical): %s", e)


# ---------------------------------------------------------------------------
# Core endpoints  (compatible with gateway memu-tools.ts)
# ---------------------------------------------------------------------------


@app.post("/memorize", response_model=MemorizeResponse)
async def memorize(req: MemorizeRequest) -> MemorizeResponse:
    """Ingest content into hierarchical memory.

    When LLM is configured, runs the full pipeline:
    1. Preprocess (conversation segmentation / document condensing)
    2. Extract memory items (5 types: profile, event, knowledge, behavior, skill)
    3. Categorize items (10 default categories)
    4. Persist with embeddings
    5. Update category summaries

    Without LLM, falls back to basic chunking + default embeddings.
    """
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")

    try:
        result = await memorize_pipeline(
            content=req.content,
            user_id=req.user_id,
            modality=req.modality,
            chroma=chroma,
            config=config,
            llm=llm,
        )
        return MemorizeResponse(
            ok=True,
            stored=result["stored"],
            user_id=req.user_id,
            memory_types=result.get("memory_types", {}),
        )
    except Exception as e:
        logger.error("Memorize failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"memorize failed: {e}") from e


@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest) -> RetrieveResponse:
    """Query hierarchical memory.

    Supports two methods:
    - "rag" (default): Vector similarity with optional category-aware boosting
    - "llm": LLM-powered ranking with query rewriting and sufficiency checking

    Both methods benefit from LLM embeddings when configured.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")

    try:
        result = await retrieve_pipeline(
            query=req.query,
            user_id=req.user_id,
            method=req.method,
            max_results=req.max_results,
            chroma=chroma,
            config=config,
            llm=llm,
        )
        items = [MemoryItem(**item) for item in result["items"]]
        return RetrieveResponse(
            ok=True,
            items=items,
            method=result["method"],
            query=result["query"],
        )
    except Exception as e:
        logger.error("Retrieve failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"retrieve failed: {e}") from e


@app.get("/status", response_model=StatusResponse)
async def status() -> StatusResponse:
    """Health check and memory statistics."""
    collections = chroma.list_collections()
    total_docs = 0
    category_count = 0
    for col in collections:
        count = col.count()
        total_docs += count
        if col.name.endswith("_cats"):
            category_count += count

    return StatusResponse(
        uptime_seconds=round(time.time() - _startup_time, 1),
        storage="chromadb",
        data_dir=config.data_dir,
        collections=len(collections),
        total_documents=total_docs,
        llm_enabled=llm.enabled,
        categories=category_count,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# CRUD endpoints  (additional management operations)
# ---------------------------------------------------------------------------


@app.post("/memories/list", response_model=ListMemoriesResponse)
async def list_memories(req: ListMemoriesRequest) -> ListMemoriesResponse:
    """List memory items with optional filtering by type and category."""
    col = get_items_collection(chroma, config, req.user_id)
    if col.count() == 0:
        return ListMemoriesResponse(items=[], total=0)

    # Get all items (ChromaDB doesn't have great pagination)
    where: dict[str, Any] | None = None
    if req.memory_type:
        where = {"memory_type": req.memory_type}

    try:
        results = col.get(where=where, limit=req.limit, offset=req.offset)
    except Exception:
        # Fallback without where filter
        results = col.get(limit=req.limit, offset=req.offset)

    items: list[MemoryItem] = []
    if results["ids"]:
        for i, doc_id in enumerate(results["ids"]):
            doc = results["documents"][i] if results["documents"] else ""
            meta = results["metadatas"][i] if results["metadatas"] else {}

            # Apply category filter client-side if needed
            if req.category and meta:
                item_cats = meta.get("categories", "").split(",")
                if req.category not in [c.strip() for c in item_cats]:
                    continue

            items.append(
                MemoryItem(
                    id=doc_id,
                    content=doc,
                    score=1.0,
                    metadata=meta or {},
                )
            )

    return ListMemoriesResponse(items=items, total=len(items))


@app.post("/memories/create", response_model=CreateMemoryResponse)
async def create_memory(req: CreateMemoryRequest) -> CreateMemoryResponse:
    """Manually create a memory item."""
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")

    col = get_items_collection(chroma, config, req.user_id)
    doc_id = deterministic_id(req.content, req.user_id, prefix=req.memory_type)

    meta: dict[str, Any] = {
        "memory_type": req.memory_type,
        "categories": ",".join(req.categories) if req.categories else "knowledge",
        "modality": "manual",
        "user_id": req.user_id,
        "timestamp": time.time(),
    }

    # Generate embedding if LLM is available
    if llm.enabled:
        try:
            embedding = await llm.embed_single(req.content)
            col.upsert(
                ids=[doc_id],
                documents=[req.content],
                metadatas=[meta],
                embeddings=[embedding],
            )
            return CreateMemoryResponse(ok=True, id=doc_id)
        except Exception:
            logger.warning("Failed to embed manual memory item")

    col.upsert(ids=[doc_id], documents=[req.content], metadatas=[meta])
    return CreateMemoryResponse(ok=True, id=doc_id)


@app.post("/memories/delete", response_model=DeleteMemoryResponse)
async def delete_memories(req: DeleteMemoryRequest) -> DeleteMemoryResponse:
    """Bulk delete memories matching filters."""
    col = get_items_collection(chroma, config, req.user_id)
    if col.count() == 0:
        return DeleteMemoryResponse(deleted=0)

    where: dict[str, Any] | None = None
    if req.memory_type:
        where = {"memory_type": req.memory_type}

    try:
        # Get matching IDs
        results = col.get(where=where)
        if not results["ids"]:
            return DeleteMemoryResponse(deleted=0)

        ids_to_delete = results["ids"]

        # Apply category filter client-side
        if req.category and results["metadatas"]:
            filtered_ids: list[str] = []
            for i, doc_id in enumerate(results["ids"]):
                meta = results["metadatas"][i] if results["metadatas"] else {}
                if meta:
                    item_cats = meta.get("categories", "").split(",")
                    if req.category in [c.strip() for c in item_cats]:
                        filtered_ids.append(doc_id)
            ids_to_delete = filtered_ids

        if ids_to_delete:
            col.delete(ids=ids_to_delete)

        return DeleteMemoryResponse(deleted=len(ids_to_delete))
    except Exception as e:
        logger.error("Delete failed: %s", e)
        raise HTTPException(status_code=500, detail=f"delete failed: {e}") from e


@app.post("/categories/list", response_model=ListCategoriesResponse)
async def list_categories(req: ListCategoriesRequest) -> ListCategoriesResponse:
    """List all categories with item counts."""
    cats_col = get_categories_collection(chroma, config, req.user_id)
    items_col = get_items_collection(chroma, config, req.user_id)

    if cats_col.count() == 0:
        # Initialize categories if they don't exist
        if llm.enabled:
            try:
                await ensure_categories(chroma, config, llm, req.user_id)
            except Exception:
                pass
        cats_data = cats_col.get()
    else:
        cats_data = cats_col.get()

    # Count items per category
    items_data = items_col.get() if items_col.count() > 0 else {"ids": [], "metadatas": []}
    cat_counts: dict[str, int] = {}
    if items_data["metadatas"]:
        for meta in items_data["metadatas"]:
            if meta:
                for cat in meta.get("categories", "").split(","):
                    cat = cat.strip()
                    if cat:
                        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    categories: list[CategoryInfo] = []
    if cats_data["ids"]:
        for i, doc_id in enumerate(cats_data["ids"]):
            meta = cats_data["metadatas"][i] if cats_data["metadatas"] else {}
            name = meta.get("name", "") if meta else ""
            if name:
                categories.append(
                    CategoryInfo(
                        name=name,
                        description=meta.get("description", "") if meta else "",
                        summary=meta.get("summary") if meta else None,
                        item_count=cat_counts.get(name, 0),
                    )
                )

    return ListCategoriesResponse(categories=categories)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=config.port)
