"""
MemU — Hierarchical Memory Sidecar for ThinkFleet agents.

Provides three REST endpoints consumed by the gateway's memu-tools:
  POST /memorize  — ingest conversation text into layered memory
  POST /retrieve  — query memory via vector similarity (RAG) or keyword
  GET  /status    — health check and memory statistics

Storage is backed by ChromaDB (SQLite + HNSW vectors) persisted to
/data/memu inside the container so memories survive restarts.
"""

from __future__ import annotations

import hashlib
import os
import re
import time
from typing import Any

import chromadb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATA_DIR = os.environ.get("MEMU_DATA_DIR", "/data/memu")
PORT = int(os.environ.get("MEMU_PORT", "8230"))
COLLECTION_PREFIX = os.environ.get("MEMU_COLLECTION_PREFIX", "memu")

# ---------------------------------------------------------------------------
# ChromaDB client (persistent)
# ---------------------------------------------------------------------------

os.makedirs(DATA_DIR, exist_ok=True)
chroma = chromadb.PersistentClient(path=DATA_DIR)

_startup_time = time.time()


def _collection_name(user_id: str) -> str:
    """Per-user collection name, sanitised for ChromaDB constraints."""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", user_id)[:48]
    return f"{COLLECTION_PREFIX}_{safe}"


def _get_or_create(user_id: str) -> chromadb.Collection:
    return chroma.get_or_create_collection(
        name=_collection_name(user_id),
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class MemorizeRequest(BaseModel):
    content: str
    user_id: str = "default"
    modality: str = "conversation"


class MemorizeResponse(BaseModel):
    ok: bool = True
    stored: int = 0
    user_id: str = "default"


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


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n{2,}")
CHUNK_MAX_CHARS = 1000
CHUNK_OVERLAP_CHARS = 100


def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks for memory storage."""
    sentences = _SENTENCE_RE.split(text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) + 1 > CHUNK_MAX_CHARS and current:
            chunks.append(current)
            # Overlap: keep tail of previous chunk
            tail = current[-CHUNK_OVERLAP_CHARS:] if len(current) > CHUNK_OVERLAP_CHARS else ""
            current = tail + " " + sent if tail else sent
        else:
            current = current + " " + sent if current else sent
    if current:
        chunks.append(current)
    return chunks


def _deterministic_id(content: str, user_id: str) -> str:
    return hashlib.sha256(f"{user_id}:{content}".encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="MemU Sidecar", version="1.0.0")


@app.post("/memorize", response_model=MemorizeResponse)
async def memorize(req: MemorizeRequest) -> MemorizeResponse:
    """Ingest content into hierarchical memory."""
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")

    collection = _get_or_create(req.user_id)
    chunks = _chunk_text(req.content)
    if not chunks:
        return MemorizeResponse(stored=0, user_id=req.user_id)

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for chunk in chunks:
        doc_id = _deterministic_id(chunk, req.user_id)
        ids.append(doc_id)
        documents.append(chunk)
        metadatas.append(
            {
                "modality": req.modality,
                "user_id": req.user_id,
                "timestamp": time.time(),
            }
        )

    # upsert so duplicate content is deduplicated
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)

    return MemorizeResponse(stored=len(chunks), user_id=req.user_id)


@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest) -> RetrieveResponse:
    """Query hierarchical memory via vector similarity."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")

    collection = _get_or_create(req.user_id)

    if collection.count() == 0:
        return RetrieveResponse(items=[], method=req.method, query=req.query)

    n_results = min(req.max_results, collection.count())
    results = collection.query(
        query_texts=[req.query],
        n_results=n_results,
    )

    items: list[MemoryItem] = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            doc = results["documents"][0][i] if results["documents"] else ""
            distance = results["distances"][0][i] if results["distances"] else 1.0
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            # ChromaDB cosine distance is 0..2; convert to 0..1 similarity
            score = max(0.0, 1.0 - distance / 2.0)
            items.append(
                MemoryItem(
                    id=doc_id,
                    content=doc,
                    score=round(score, 4),
                    metadata=meta or {},
                )
            )

    return RetrieveResponse(
        items=items,
        method=req.method,
        query=req.query,
    )


@app.get("/status", response_model=StatusResponse)
async def status() -> StatusResponse:
    """Health check and memory statistics."""
    collections = chroma.list_collections()
    total_docs = 0
    for col in collections:
        total_docs += col.count()

    return StatusResponse(
        uptime_seconds=round(time.time() - _startup_time, 1),
        storage="chromadb",
        data_dir=DATA_DIR,
        collections=len(collections),
        total_documents=total_docs,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
