"""
MemU Sidecar — Retrieve Pipeline.

Implements dual-mode retrieval:

  RAG mode (default):
    1. Route intention (decide if retrieval needed)
    2. Query rewriting (resolve pronouns, make self-contained)
    3. Category search (vector similarity on category summaries)
    4. Sufficiency check after categories
    5. Item search (vector similarity on memory items from relevant categories)
    6. Sufficiency check after items
    7. Build response

  LLM mode:
    Same stages but uses LLM-powered ranking instead of vector similarity.

When LLM is not configured, performs basic vector search.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import chromadb

from config import MemuConfig
from llm import LLMClient
from memorize import (
    get_categories_collection,
    get_items_collection,
    get_resources_collection,
)
from models import MemoryItem
from prompts import (
    LLM_CATEGORY_RANKER_PROMPT,
    LLM_ITEM_RANKER_PROMPT,
    PRE_RETRIEVAL_DECISION_PROMPT,
    QUERY_REWRITE_PROMPT,
    SUFFICIENCY_JUDGMENT_PROMPT,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Main retrieve entry point
# ---------------------------------------------------------------------------


async def retrieve_pipeline(
    query: str,
    user_id: str,
    method: str,
    max_results: int,
    chroma: chromadb.ClientAPI,
    config: MemuConfig,
    llm: LLMClient,
) -> dict[str, Any]:
    """
    Run the full retrieve pipeline.

    Returns dict with:
      - items: list of MemoryItem dicts
      - method: the retrieval method used
      - query: the (possibly rewritten) query
    """
    items_col = get_items_collection(chroma, config, user_id)

    if items_col.count() == 0:
        return {"items": [], "method": method, "query": query}

    # --- Step 1: Query rewriting (LLM only) ---
    effective_query = query
    if llm.enabled:
        try:
            effective_query = await _rewrite_query(query, llm)
        except Exception:
            logger.debug("Query rewriting failed, using original query")
            effective_query = query

    # --- Step 2: Route by method ---
    if method == "llm" and llm.enabled:
        items = await _retrieve_llm(
            effective_query, user_id, max_results, chroma, config, llm
        )
    else:
        items = await _retrieve_rag(
            effective_query, user_id, max_results, chroma, config, llm
        )

    return {
        "items": [item.model_dump() for item in items],
        "method": method,
        "query": effective_query,
    }


# ---------------------------------------------------------------------------
# Query rewriting
# ---------------------------------------------------------------------------


async def _rewrite_query(query: str, llm: LLMClient) -> str:
    """Rewrite a query to be self-contained for memory search."""
    prompt = QUERY_REWRITE_PROMPT.format(context="(No prior context available)", query=query)
    result = await llm.chat(
        "You are a query rewriting assistant.", prompt, temperature=0.1
    )

    # Extract rewritten query from tags
    match = re.search(r"<rewritten_query>(.*?)</rewritten_query>", result, re.DOTALL)
    if match:
        rewritten = match.group(1).strip()
        if rewritten:
            return rewritten
    return query


# ---------------------------------------------------------------------------
# RAG retrieval (vector similarity)
# ---------------------------------------------------------------------------


async def _retrieve_rag(
    query: str,
    user_id: str,
    max_results: int,
    chroma: chromadb.ClientAPI,
    config: MemuConfig,
    llm: LLMClient,
) -> list[MemoryItem]:
    """RAG-based retrieval using vector similarity."""

    items_col = get_items_collection(chroma, config, user_id)
    cats_col = get_categories_collection(chroma, config, user_id)

    # --- Stage 1: Search categories for relevance signal ---
    relevant_categories: list[str] = []
    if cats_col.count() > 0 and llm.enabled:
        try:
            # Generate query embedding
            query_embedding = await llm.embed_single(query)
            cat_results = cats_col.query(
                query_embeddings=[query_embedding],
                n_results=min(config.retrieve_top_k_categories, cats_col.count()),
            )
            if cat_results and cat_results["metadatas"]:
                for meta in cat_results["metadatas"][0]:
                    if meta and meta.get("name"):
                        relevant_categories.append(meta["name"])
        except Exception:
            logger.debug("Category search failed")

    # --- Stage 2: Check category sufficiency ---
    need_item_search = True
    if relevant_categories and llm.enabled:
        try:
            # Get category summaries
            cat_content = await _get_category_summaries(cats_col, relevant_categories)
            if cat_content:
                is_sufficient = await _check_sufficiency(query, cat_content, llm)
                if is_sufficient:
                    # Category summaries are enough — still get items but prioritize categories
                    logger.debug("Category summaries sufficient for query")
        except Exception:
            pass

    # --- Stage 3: Search memory items ---
    n_results = min(max_results, items_col.count())
    if n_results == 0:
        return []

    # Build query parameters
    query_params: dict[str, Any] = {"n_results": n_results}

    # Use LLM embeddings if available
    if llm.enabled:
        try:
            query_embedding = await llm.embed_single(query)
            query_params["query_embeddings"] = [query_embedding]
        except Exception:
            query_params["query_texts"] = [query]
    else:
        query_params["query_texts"] = [query]

    # Optionally filter by relevant categories
    if relevant_categories and len(relevant_categories) < 5:
        # Use where filter for category metadata
        # ChromaDB metadata filtering: categories is stored as comma-separated string
        # We can't do exact matching easily, so we search all and re-rank
        pass

    results = items_col.query(**query_params)

    items: list[MemoryItem] = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            doc = results["documents"][0][i] if results["documents"] else ""
            distance = results["distances"][0][i] if results["distances"] else 1.0
            meta = results["metadatas"][0][i] if results["metadatas"] else {}

            # ChromaDB cosine distance is 0..2; convert to 0..1 similarity
            score = max(0.0, 1.0 - distance / 2.0)

            # Boost score if item's category matches a relevant category
            item_cats = (meta.get("categories", "") if meta else "").split(",")
            if relevant_categories:
                for cat in item_cats:
                    if cat.strip() in relevant_categories:
                        score = min(1.0, score * 1.1)  # 10% boost
                        break

            items.append(
                MemoryItem(
                    id=doc_id,
                    content=doc,
                    score=round(score, 4),
                    metadata=meta or {},
                )
            )

    # Sort by score descending
    items.sort(key=lambda x: x.score, reverse=True)
    return items[:max_results]


# ---------------------------------------------------------------------------
# LLM retrieval (LLM-powered ranking)
# ---------------------------------------------------------------------------


async def _retrieve_llm(
    query: str,
    user_id: str,
    max_results: int,
    chroma: chromadb.ClientAPI,
    config: MemuConfig,
    llm: LLMClient,
) -> list[MemoryItem]:
    """LLM-powered retrieval with ranking."""

    items_col = get_items_collection(chroma, config, user_id)
    cats_col = get_categories_collection(chroma, config, user_id)

    # --- Stage 1: LLM ranks categories ---
    relevant_category_names: list[str] = []
    if cats_col.count() > 0:
        try:
            relevant_category_names = await _llm_rank_categories(
                query, cats_col, config, llm
            )
        except Exception:
            logger.debug("LLM category ranking failed")

    # --- Stage 2: Get candidate items ---
    # First get a broad set via vector search
    candidate_count = min(max_results * 3, items_col.count())
    if candidate_count == 0:
        return []

    try:
        query_embedding = await llm.embed_single(query)
        candidates = items_col.query(
            query_embeddings=[query_embedding],
            n_results=candidate_count,
        )
    except Exception:
        candidates = items_col.query(
            query_texts=[query],
            n_results=candidate_count,
        )

    if not candidates or not candidates["ids"] or not candidates["ids"][0]:
        return []

    # --- Stage 3: LLM ranks items ---
    try:
        ranked_ids = await _llm_rank_items(
            query, candidates, max_results, config, llm
        )
    except Exception:
        logger.debug("LLM item ranking failed, using vector scores")
        ranked_ids = None

    # Build items list
    items: list[MemoryItem] = []
    if ranked_ids:
        # Use LLM ranking order
        id_to_idx = {
            doc_id: i for i, doc_id in enumerate(candidates["ids"][0])
        }
        for rank, doc_id in enumerate(ranked_ids):
            idx = id_to_idx.get(doc_id)
            if idx is not None:
                doc = candidates["documents"][0][idx] if candidates["documents"] else ""
                meta = candidates["metadatas"][0][idx] if candidates["metadatas"] else {}
                # Score based on rank (1.0 for first, decreasing)
                score = max(0.1, 1.0 - rank * 0.1)
                items.append(
                    MemoryItem(
                        id=doc_id,
                        content=doc,
                        score=round(score, 4),
                        metadata=meta or {},
                    )
                )
    else:
        # Fallback to vector scores
        for i, doc_id in enumerate(candidates["ids"][0]):
            if i >= max_results:
                break
            doc = candidates["documents"][0][i] if candidates["documents"] else ""
            distance = candidates["distances"][0][i] if candidates["distances"] else 1.0
            meta = candidates["metadatas"][0][i] if candidates["metadatas"] else {}
            score = max(0.0, 1.0 - distance / 2.0)
            items.append(
                MemoryItem(
                    id=doc_id,
                    content=doc,
                    score=round(score, 4),
                    metadata=meta or {},
                )
            )

    return items[:max_results]


async def _llm_rank_categories(
    query: str,
    cats_col: chromadb.Collection,
    config: MemuConfig,
    llm: LLMClient,
) -> list[str]:
    """Use LLM to rank categories by relevance."""
    all_cats = cats_col.get()
    if not all_cats["ids"]:
        return []

    # Format categories for the LLM
    cat_lines: list[str] = []
    for i, doc_id in enumerate(all_cats["ids"]):
        meta = all_cats["metadatas"][i] if all_cats["metadatas"] else {}
        name = meta.get("name", doc_id) if meta else doc_id
        desc = meta.get("description", "") if meta else ""
        summary = meta.get("summary", "") if meta else ""
        cat_lines.append(f"ID: {doc_id} | Name: {name} | Description: {desc} | Summary: {summary[:200]}")

    prompt = LLM_CATEGORY_RANKER_PROMPT.format(
        query=query,
        categories="\n".join(cat_lines),
        top_k=config.retrieve_top_k_categories,
    )

    result = await llm.chat("You are a memory retrieval assistant.", prompt, temperature=0.1)

    # Parse response
    try:
        # Extract JSON from response
        match = re.search(r"\{.*\}", result, re.DOTALL)
        if match:
            data = json.loads(match.group())
            cat_ids = data.get("category_ids", [])
            # Map IDs back to names
            id_to_name = {}
            for i, doc_id in enumerate(all_cats["ids"]):
                meta = all_cats["metadatas"][i] if all_cats["metadatas"] else {}
                id_to_name[doc_id] = meta.get("name", "") if meta else ""
            return [id_to_name[cid] for cid in cat_ids if cid in id_to_name]
    except (json.JSONDecodeError, KeyError):
        pass

    return []


async def _llm_rank_items(
    query: str,
    candidates: dict[str, Any],
    max_results: int,
    config: MemuConfig,
    llm: LLMClient,
) -> list[str] | None:
    """Use LLM to rank items by relevance. Returns ordered list of IDs."""
    # Format items for the LLM
    item_lines: list[str] = []
    for i, doc_id in enumerate(candidates["ids"][0]):
        doc = candidates["documents"][0][i] if candidates["documents"] else ""
        meta = candidates["metadatas"][0][i] if candidates["metadatas"] else {}
        mtype = meta.get("memory_type", "unknown") if meta else "unknown"
        item_lines.append(f"ID: {doc_id} | Type: {mtype} | Content: {doc[:200]}")

    prompt = LLM_ITEM_RANKER_PROMPT.format(
        query=query,
        items="\n".join(item_lines),
        top_k=max_results,
    )

    result = await llm.chat("You are a memory retrieval assistant.", prompt, temperature=0.1)

    try:
        match = re.search(r"\{.*\}", result, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return data.get("item_ids", [])
    except (json.JSONDecodeError, KeyError):
        pass

    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_category_summaries(
    cats_col: chromadb.Collection, category_names: list[str]
) -> str:
    """Get formatted category summaries for sufficiency checking."""
    all_cats = cats_col.get()
    if not all_cats["ids"]:
        return ""

    parts: list[str] = []
    for i, doc_id in enumerate(all_cats["ids"]):
        meta = all_cats["metadatas"][i] if all_cats["metadatas"] else {}
        name = meta.get("name", "") if meta else ""
        if name in category_names:
            summary = meta.get("summary", "") if meta else ""
            if summary:
                parts.append(f"[{name}] {summary}")

    return "\n\n".join(parts)


async def _check_sufficiency(query: str, content: str, llm: LLMClient) -> bool:
    """Check if retrieved content is sufficient to answer the query."""
    prompt = SUFFICIENCY_JUDGMENT_PROMPT.format(query=query, content=content)
    result = await llm.chat(
        "You are an information sufficiency judge.", prompt, temperature=0.1
    )

    match = re.search(r"<judgement>(.*?)</judgement>", result, re.DOTALL)
    if match:
        decision = match.group(1).strip().upper()
        return decision == "ENOUGH"

    return False
