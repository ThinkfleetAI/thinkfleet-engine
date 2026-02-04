"""
MemU Sidecar — Memorize Pipeline.

Implements the multi-stage ingestion pipeline:

  1. Preprocess (modality-specific: conversation segmentation, document condensing)
  2. Extract memory items (LLM-powered: 5 memory types)
  3. Categorize items (LLM-powered: assign to categories)
  4. Embed & persist (ChromaDB upsert with embeddings)
  5. Update category summaries

When LLM is not configured, falls back to basic chunking + vector storage.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
from typing import Any

import chromadb

from config import DEFAULT_CATEGORIES, MEMORY_TYPES, MemuConfig
from llm import LLMClient
from models import ExtractedMemory
from prompts import (
    CATEGORIZE_ITEMS_PROMPT,
    CATEGORY_SUMMARY_PROMPT,
    CONVERSATION_SEGMENTATION_PROMPT,
    DOCUMENT_PREPROCESS_PROMPT,
    MEMORY_TYPE_PROMPTS,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Text chunking (fallback when LLM is unavailable)
# ---------------------------------------------------------------------------

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n{2,}")


def chunk_text(text: str, max_chars: int = 1000, overlap: int = 100) -> list[str]:
    """Split text into overlapping chunks for basic memory storage."""
    sentences = _SENTENCE_RE.split(text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) + 1 > max_chars and current:
            chunks.append(current)
            tail = current[-overlap:] if len(current) > overlap else ""
            current = tail + " " + sent if tail else sent
        else:
            current = current + " " + sent if current else sent
    if current:
        chunks.append(current)
    return chunks


def deterministic_id(content: str, user_id: str, prefix: str = "") -> str:
    """Generate a deterministic ID for deduplication."""
    raw = f"{prefix}:{user_id}:{content}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Collection helpers
# ---------------------------------------------------------------------------


def get_items_collection(
    chroma: chromadb.ClientAPI, config: MemuConfig, user_id: str
) -> chromadb.Collection:
    """Get or create the memory items collection for a user."""
    safe_user = re.sub(r"[^a-zA-Z0-9_-]", "_", user_id)[:48]
    name = f"{config.collection_prefix}_{safe_user}_items"
    return chroma.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})


def get_categories_collection(
    chroma: chromadb.ClientAPI, config: MemuConfig, user_id: str
) -> chromadb.Collection:
    """Get or create the categories collection for a user."""
    safe_user = re.sub(r"[^a-zA-Z0-9_-]", "_", user_id)[:48]
    name = f"{config.collection_prefix}_{safe_user}_cats"
    return chroma.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})


def get_resources_collection(
    chroma: chromadb.ClientAPI, config: MemuConfig, user_id: str
) -> chromadb.Collection:
    """Get or create the resources collection for a user."""
    safe_user = re.sub(r"[^a-zA-Z0-9_-]", "_", user_id)[:48]
    name = f"{config.collection_prefix}_{safe_user}_res"
    return chroma.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})


# ---------------------------------------------------------------------------
# Category initialization
# ---------------------------------------------------------------------------


async def ensure_categories(
    chroma: chromadb.ClientAPI,
    config: MemuConfig,
    llm: LLMClient,
    user_id: str,
) -> dict[str, str]:
    """Ensure default categories exist. Returns name→id mapping."""
    col = get_categories_collection(chroma, config, user_id)

    # Check if categories already exist
    existing = col.get()
    if existing["ids"]:
        name_to_id: dict[str, str] = {}
        for i, doc_id in enumerate(existing["ids"]):
            meta = existing["metadatas"][i] if existing["metadatas"] else {}
            if meta and meta.get("name"):
                name_to_id[meta["name"]] = doc_id
        if name_to_id:
            return name_to_id

    # Create default categories
    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []
    embeddings: list[list[float]] | None = None

    for cat in DEFAULT_CATEGORIES:
        cat_id = deterministic_id(cat["name"], user_id, prefix="cat")
        ids.append(cat_id)
        doc_text = f"{cat['name']}: {cat['description']}"
        documents.append(doc_text)
        metadatas.append({
            "name": cat["name"],
            "description": cat["description"],
            "summary": "",
            "type": "category",
            "user_id": user_id,
            "created_at": time.time(),
        })

    # Generate embeddings if LLM is available
    if llm.enabled:
        try:
            embeddings = await llm.embed(documents)
        except Exception:
            logger.warning("Failed to embed categories, using default embeddings")
            embeddings = None

    if embeddings:
        col.upsert(ids=ids, documents=documents, metadatas=metadatas, embeddings=embeddings)
    else:
        col.upsert(ids=ids, documents=documents, metadatas=metadatas)

    return {cat["name"]: deterministic_id(cat["name"], user_id, prefix="cat") for cat in DEFAULT_CATEGORIES}


# ---------------------------------------------------------------------------
# Stage 1: Preprocess
# ---------------------------------------------------------------------------


async def preprocess_content(
    content: str,
    modality: str,
    config: MemuConfig,
    llm: LLMClient,
) -> list[str]:
    """Preprocess content based on modality. Returns text segments."""
    if not llm.enabled:
        # Fallback: simple chunking
        return chunk_text(content, config.chunk_max_chars, config.chunk_overlap_chars)

    if modality == "conversation":
        return await _preprocess_conversation(content, config, llm)
    elif modality == "document":
        return await _preprocess_document(content, llm)
    else:
        # For other modalities, chunk the content
        return chunk_text(content, config.chunk_max_chars, config.chunk_overlap_chars)


async def _preprocess_conversation(
    content: str, config: MemuConfig, llm: LLMClient
) -> list[str]:
    """Segment a conversation into topically coherent chunks."""
    lines = content.strip().split("\n")
    if len(lines) < config.conversation_segment_min_messages * 2:
        # Too short to segment — use as one chunk
        return [content.strip()] if content.strip() else []

    # Add index markers
    indexed = "\n".join(f"[{i}] {line}" for i, line in enumerate(lines))

    try:
        prompt = CONVERSATION_SEGMENTATION_PROMPT.format(
            min_messages=config.conversation_segment_min_messages,
            content=indexed,
        )
        result = await llm.chat(
            "You are a conversation analysis assistant.",
            prompt,
            temperature=0.1,
        )
        # Parse JSON segments
        segments = _parse_segments(result, lines)
        if segments:
            return segments
    except Exception:
        logger.warning("Conversation segmentation failed, falling back to chunking")

    return chunk_text(content, config.chunk_max_chars, config.chunk_overlap_chars)


def _parse_segments(llm_response: str, lines: list[str]) -> list[str]:
    """Parse segment JSON from LLM response."""
    # Extract JSON array from response
    match = re.search(r"\[.*\]", llm_response, re.DOTALL)
    if not match:
        return []
    try:
        segments = json.loads(match.group())
    except json.JSONDecodeError:
        return []

    result: list[str] = []
    for seg in segments:
        start = seg.get("start", 0)
        end = seg.get("end", len(lines) - 1)
        start = max(0, min(start, len(lines) - 1))
        end = max(start, min(end, len(lines) - 1))
        segment_text = "\n".join(lines[start : end + 1]).strip()
        if segment_text:
            result.append(segment_text)
    return result


async def _preprocess_document(content: str, llm: LLMClient) -> list[str]:
    """Condense a document into key content."""
    try:
        prompt = DOCUMENT_PREPROCESS_PROMPT.format(content=content[:8000])
        result = await llm.chat("You are a document processing assistant.", prompt)
        # Extract processed content
        match = re.search(
            r"<processed_content>(.*?)</processed_content>", result, re.DOTALL
        )
        if match:
            processed = match.group(1).strip()
            if processed:
                return [processed]
    except Exception:
        logger.warning("Document preprocessing failed, falling back to chunking")

    return chunk_text(content, 1000, 100)


# ---------------------------------------------------------------------------
# Stage 2: Extract memory items (LLM-powered)
# ---------------------------------------------------------------------------


async def extract_memory_items(
    segments: list[str],
    config: MemuConfig,
    llm: LLMClient,
) -> list[ExtractedMemory]:
    """Extract structured memory items from text segments using LLM."""
    if not llm.enabled:
        # Fallback: treat each chunk as a generic knowledge item
        return [
            ExtractedMemory(memory_type="knowledge", summary=seg)
            for seg in segments
        ]

    all_items: list[ExtractedMemory] = []

    # Process each segment and extract all memory types in parallel
    for segment in segments:
        tasks = []
        for memory_type in MEMORY_TYPES:
            tasks.append(_extract_type(segment, memory_type, llm))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result in results:
            if isinstance(result, list):
                all_items.extend(result)
            elif isinstance(result, Exception):
                logger.warning("Extraction failed: %s", result)

    return all_items


async def _extract_type(
    text: str, memory_type: str, llm: LLMClient
) -> list[ExtractedMemory]:
    """Extract memory items of a specific type from text."""
    prompt = MEMORY_TYPE_PROMPTS.get(memory_type, "")
    if not prompt:
        return []

    try:
        result = await llm.chat(prompt, text[:6000], temperature=0.1)
        return _parse_extracted_items(result, memory_type)
    except Exception as e:
        logger.warning("Failed to extract %s: %s", memory_type, e)
        return []


def _parse_extracted_items(llm_response: str, memory_type: str) -> list[ExtractedMemory]:
    """Parse extracted items from LLM response."""
    # Look for <items>...</items> tags
    match = re.search(r"<items>(.*?)</items>", llm_response, re.DOTALL)
    if not match:
        return []

    items_text = match.group(1).strip()
    if not items_text:
        return []

    items: list[ExtractedMemory] = []
    for line in items_text.split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("-"):
            # Remove any leading bullet/number markers
            cleaned = re.sub(r"^[\d.)\-*]+\s*", "", line).strip()
            if cleaned and len(cleaned) > 5:
                items.append(ExtractedMemory(memory_type=memory_type, summary=cleaned))

    return items


# ---------------------------------------------------------------------------
# Stage 3: Categorize items (LLM-powered)
# ---------------------------------------------------------------------------


async def categorize_items(
    items: list[ExtractedMemory],
    config: MemuConfig,
    llm: LLMClient,
) -> list[ExtractedMemory]:
    """Assign categories to extracted memory items."""
    if not llm.enabled or not items:
        # Fallback: assign based on memory type
        type_to_category = {
            "profile": ["personal_info"],
            "event": ["experiences"],
            "knowledge": ["knowledge"],
            "behavior": ["habits"],
            "skill": ["knowledge", "work_life"],
        }
        for item in items:
            item.categories = type_to_category.get(item.memory_type, ["knowledge"])
        return items

    # Build category list and items list for the prompt
    cat_text = "\n".join(
        f"- {cat['name']}: {cat['description']}" for cat in DEFAULT_CATEGORIES
    )
    items_text = "\n".join(
        f"[{i}] ({item.memory_type}) {item.summary}" for i, item in enumerate(items)
    )

    try:
        prompt = CATEGORIZE_ITEMS_PROMPT.format(categories=cat_text, items=items_text)
        result = await llm.chat(
            "You are a memory categorization assistant.",
            prompt,
            temperature=0.1,
        )
        _apply_categories(result, items)
    except Exception:
        logger.warning("Categorization failed, using type-based defaults")
        type_to_category = {
            "profile": ["personal_info"],
            "event": ["experiences"],
            "knowledge": ["knowledge"],
            "behavior": ["habits"],
            "skill": ["knowledge", "work_life"],
        }
        for item in items:
            item.categories = type_to_category.get(item.memory_type, ["knowledge"])

    return items


def _apply_categories(llm_response: str, items: list[ExtractedMemory]) -> None:
    """Parse categorization response and apply to items."""
    # Extract JSON array
    match = re.search(r"\[.*\]", llm_response, re.DOTALL)
    if not match:
        return

    try:
        assignments = json.loads(match.group())
    except json.JSONDecodeError:
        return

    valid_names = {cat["name"] for cat in DEFAULT_CATEGORIES}
    for assignment in assignments:
        idx = assignment.get("index", -1)
        cats = assignment.get("categories", [])
        if 0 <= idx < len(items):
            # Filter to valid category names
            valid_cats = [c for c in cats if c in valid_names]
            items[idx].categories = valid_cats or ["knowledge"]


# ---------------------------------------------------------------------------
# Stage 4: Embed & persist
# ---------------------------------------------------------------------------


async def persist_items(
    items: list[ExtractedMemory],
    user_id: str,
    modality: str,
    chroma: chromadb.ClientAPI,
    config: MemuConfig,
    llm: LLMClient,
    category_map: dict[str, str],
) -> int:
    """Embed and persist memory items to ChromaDB. Returns count stored."""
    if not items:
        return 0

    col = get_items_collection(chroma, config, user_id)

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for item in items:
        doc_id = deterministic_id(item.summary, user_id, prefix=item.memory_type)
        ids.append(doc_id)
        documents.append(item.summary)
        metadatas.append({
            "memory_type": item.memory_type,
            "categories": ",".join(item.categories) if item.categories else "knowledge",
            "modality": modality,
            "user_id": user_id,
            "timestamp": time.time(),
        })

    # Generate embeddings if LLM is available
    embeddings: list[list[float]] | None = None
    if llm.enabled:
        try:
            embeddings = await llm.embed(documents)
        except Exception:
            logger.warning("Failed to generate embeddings, using ChromaDB defaults")

    if embeddings:
        col.upsert(ids=ids, documents=documents, metadatas=metadatas, embeddings=embeddings)
    else:
        col.upsert(ids=ids, documents=documents, metadatas=metadatas)

    return len(ids)


# ---------------------------------------------------------------------------
# Stage 5: Update category summaries
# ---------------------------------------------------------------------------


async def update_category_summaries(
    items: list[ExtractedMemory],
    user_id: str,
    chroma: chromadb.ClientAPI,
    config: MemuConfig,
    llm: LLMClient,
    category_map: dict[str, str],
) -> None:
    """Update summaries for categories that received new items."""
    if not llm.enabled or not items:
        return

    # Group items by category
    cat_items: dict[str, list[str]] = {}
    for item in items:
        for cat_name in item.categories:
            if cat_name not in cat_items:
                cat_items[cat_name] = []
            cat_items[cat_name].append(f"({item.memory_type}) {item.summary}")

    if not cat_items:
        return

    col = get_categories_collection(chroma, config, user_id)

    # Update each affected category
    tasks = []
    for cat_name, new_items in cat_items.items():
        tasks.append(
            _update_single_category(cat_name, new_items, user_id, col, config, llm, category_map)
        )

    await asyncio.gather(*tasks, return_exceptions=True)


async def _update_single_category(
    cat_name: str,
    new_items: list[str],
    user_id: str,
    col: chromadb.Collection,
    config: MemuConfig,
    llm: LLMClient,
    category_map: dict[str, str],
) -> None:
    """Update the summary for a single category."""
    cat_id = category_map.get(cat_name)
    if not cat_id:
        return

    # Get existing category data
    try:
        existing = col.get(ids=[cat_id])
    except Exception:
        return

    existing_summary = ""
    description = ""
    if existing["metadatas"] and existing["metadatas"][0]:
        existing_summary = existing["metadatas"][0].get("summary", "")
        description = existing["metadatas"][0].get("description", "")

    # Build prompt
    items_text = "\n".join(f"- {item}" for item in new_items)
    prompt = CATEGORY_SUMMARY_PROMPT.format(
        category_name=cat_name,
        category_description=description,
        existing_summary=existing_summary or "(empty — no previous summary)",
        new_items=items_text,
        target_length=config.category_summary_target_length,
    )

    try:
        updated_summary = await llm.chat(
            "You are a memory summarization assistant.",
            prompt,
            temperature=0.2,
        )
        updated_summary = updated_summary.strip()

        # Update category in ChromaDB
        meta = existing["metadatas"][0] if existing["metadatas"] else {}
        meta["summary"] = updated_summary
        meta["updated_at"] = time.time()

        # Re-embed with updated summary
        doc_text = f"{cat_name}: {description}\n{updated_summary}"
        try:
            embedding = await llm.embed_single(doc_text)
            col.update(ids=[cat_id], documents=[doc_text], metadatas=[meta], embeddings=[embedding])
        except Exception:
            col.update(ids=[cat_id], documents=[doc_text], metadatas=[meta])

    except Exception:
        logger.warning("Failed to update summary for category %s", cat_name)


# ---------------------------------------------------------------------------
# Store resource (the raw ingested content)
# ---------------------------------------------------------------------------


async def store_resource(
    content: str,
    user_id: str,
    modality: str,
    chroma: chromadb.ClientAPI,
    config: MemuConfig,
    llm: LLMClient,
) -> str:
    """Store the original resource content. Returns resource ID."""
    col = get_resources_collection(chroma, config, user_id)
    res_id = deterministic_id(content[:500], user_id, prefix="res")

    # Truncate very long content for storage
    stored_content = content[:5000]
    meta: dict[str, Any] = {
        "modality": modality,
        "user_id": user_id,
        "timestamp": time.time(),
        "content_length": len(content),
    }

    if llm.enabled:
        try:
            embedding = await llm.embed_single(stored_content[:2000])
            col.upsert(
                ids=[res_id],
                documents=[stored_content],
                metadatas=[meta],
                embeddings=[embedding],
            )
            return res_id
        except Exception:
            logger.warning("Failed to embed resource")

    col.upsert(ids=[res_id], documents=[stored_content], metadatas=[meta])
    return res_id


# ---------------------------------------------------------------------------
# Full memorize pipeline
# ---------------------------------------------------------------------------


async def memorize_pipeline(
    content: str,
    user_id: str,
    modality: str,
    chroma: chromadb.ClientAPI,
    config: MemuConfig,
    llm: LLMClient,
) -> dict[str, Any]:
    """
    Run the full memorize pipeline:
    1. Ensure categories exist
    2. Store raw resource
    3. Preprocess content
    4. Extract memory items
    5. Categorize items
    6. Persist items
    7. Update category summaries
    """
    # Step 1: Ensure categories
    category_map = await ensure_categories(chroma, config, llm, user_id)

    # Step 2: Store raw resource (fire and forget, don't block)
    resource_task = asyncio.create_task(
        store_resource(content, user_id, modality, chroma, config, llm)
    )

    # Step 3: Preprocess
    segments = await preprocess_content(content, modality, config, llm)
    if not segments:
        await resource_task
        return {"stored": 0, "memory_types": {}}

    # Step 4: Extract
    items = await extract_memory_items(segments, config, llm)

    # Step 5: Categorize
    items = await categorize_items(items, config, llm)

    # Step 6: Persist
    stored = await persist_items(items, user_id, modality, chroma, config, llm, category_map)

    # Step 7: Update category summaries (async, don't block response)
    asyncio.create_task(
        update_category_summaries(items, user_id, chroma, config, llm, category_map)
    )

    # Wait for resource storage
    await resource_task

    # Count by type
    type_counts: dict[str, int] = {}
    for item in items:
        type_counts[item.memory_type] = type_counts.get(item.memory_type, 0) + 1

    return {"stored": stored, "memory_types": type_counts}
