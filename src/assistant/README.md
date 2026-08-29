# SOMS AI Assistant (RAG)

Gemini-powered internal copilot. Vectors stored in **MongoDB**.

## Full documentation

**Complete guides (features, API, MongoDB, admin UI, deployment):**

👉 **[`../../../docs/ai-assistant/README.md`](../../../docs/ai-assistant/README.md)**

Master index: [`../../../docs/README.md`](../../../docs/README.md)

## Quick reference

| Item | Path |
|------|------|
| API base | `/api/v1/assistant` |
| Admin UI | Management → System → AI Assistant |
| Embeddings | `assistant_knowledge_chunks.embedding` |
| Config | MongoDB `assistant_configs` id=1 |
| Upload dir | `uploads/assistant-knowledge/` |

## Env

```env
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

## Module layout

```
src/assistant/
  config/          Defaults & seeds
  models/          MongoDB schemas
  services/
    gemini/        Chat + embeddings
    rag/           Chunk, ingest, retrieve, parse
  controllers/     HTTP
  routes/          Express router
```

See [file structure doc](../../../docs/ai-assistant/10-file-structure.md) for complete map.
