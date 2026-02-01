---
name: rag-engineer
description: "Build RAG systems: document chunking, embedding generation, vector storage, retrieval strategies, and answer generation."
metadata: {"thinkfleetbot":{"emoji":"📚","requires":{"anyBins":["python3","curl"]}}}
---

# RAG Engineering

Build Retrieval-Augmented Generation pipelines: chunk, embed, store, retrieve, generate.

## Pipeline Overview

```
Documents → Chunk → Embed → Store in Vector DB → Query → Retrieve → Generate Answer
```

## Document Chunking

```python
# Simple fixed-size chunking with overlap
def chunk_text(text, chunk_size=500, overlap=50):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks

# Semantic chunking (by paragraph/section)
def chunk_by_paragraphs(text, max_size=1000):
    paragraphs = text.split('\n\n')
    chunks, current = [], ""
    for p in paragraphs:
        if len(current) + len(p) > max_size and current:
            chunks.append(current.strip())
            current = p
        else:
            current += "\n\n" + p
    if current:
        chunks.append(current.strip())
    return chunks
```

## Generate Embeddings

### OpenAI

```bash
curl -s https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "Your text to embed", "model": "text-embedding-3-small"}' \
  | jq '.data[0].embedding[:5]'
```

### Python with OpenAI

```python
from openai import OpenAI
client = OpenAI()

def get_embedding(text, model="text-embedding-3-small"):
    return client.embeddings.create(input=text, model=model).data[0].embedding

# Batch embed
texts = ["chunk 1", "chunk 2", "chunk 3"]
response = client.embeddings.create(input=texts, model="text-embedding-3-small")
embeddings = [d.embedding for d in response.data]
```

## Vector Storage

### Supabase (pgvector)

```bash
# Create table
psql $DATABASE_URL -c "
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1536),
  metadata JSONB
);
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
"

# Query similar documents
psql $DATABASE_URL -c "
SELECT content, 1 - (embedding <=> '[0.1, 0.2, ...]') AS similarity
FROM documents
ORDER BY embedding <=> '[0.1, 0.2, ...]'
LIMIT 5;
"
```

### ChromaDB (Local)

```python
import chromadb
client = chromadb.Client()
collection = client.create_collection("docs")

# Add documents
collection.add(
    documents=["chunk 1", "chunk 2"],
    ids=["id1", "id2"],
    metadatas=[{"source": "file1"}, {"source": "file2"}]
)

# Query
results = collection.query(query_texts=["search query"], n_results=5)
print(results["documents"])
```

## Retrieval Strategies

### Basic similarity search
Embed the query, find top-K nearest chunks.

### Hybrid search (keyword + semantic)
Combine BM25 text search with vector similarity. Weight and merge results.

### Re-ranking
Retrieve top-20, then re-rank with a cross-encoder model to get top-5.

### Contextual retrieval
Prepend document-level context to each chunk before embedding:
```
"This chunk is from the API documentation, section: Authentication. "
+ original chunk text
```

## Answer Generation

```bash
# Claude with retrieved context
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "system": "Answer questions using only the provided context. If the context does not contain the answer, say so.",
    "messages": [{"role": "user", "content": "Context:\n[retrieved chunks here]\n\nQuestion: How do I authenticate?"}]
  }' | jq '.content[0].text'
```

## Notes

- Chunk size matters. Too small = lost context. Too large = noise in retrieval. 300-800 tokens is typical.
- Overlap prevents splitting key information across chunk boundaries.
- Embedding model choice affects quality significantly. `text-embedding-3-small` is cost-effective; `text-embedding-3-large` is higher quality.
- Always include source metadata with chunks so you can cite references.
- Test retrieval quality before building the full pipeline — if retrieval is bad, generation can't fix it.
