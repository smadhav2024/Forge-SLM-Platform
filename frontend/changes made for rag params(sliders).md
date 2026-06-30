# Forge — RAG Parameter Controls

## What changed

### 9 files modified, 0 new files

---

## Backend

### `backend/rag_worker.py`
- `process_document_task` now accepts `chunk_size` (default 500) and `overlap` (default 50) as explicit params
- `chunk_text` guards against `overlap >= chunk_size` (clamps to `chunk_size // 2`)

### `backend/routes/documents.py`
- POST `/conversations/{id}/documents` accepts two query params:
  - `chunk_size` (int, 100–2000, default 500)
  - `chunk_overlap` (int, 0–500, default 50)
- **100 MB file size limit** enforced before writing to disk (HTTP 413 on breach)
- Overlap clamped to `chunk_size // 2` server-side as a safety guard
- Both params forwarded to `process_document_task`

### `backend/routes/inference.py`
- `ChatCompletionRequest` gets three new optional fields:
  - `top_k` (int, 1–10, default 3) — chunks retrieved per query
  - `similarity_threshold` (float, 0.0–1.0, default 0.0) — min cosine similarity to include a chunk; 0 = disabled
  - `context_budget` (int, 200–4000, default 1500) — max chars injected into system prompt
- `prepare_rag_and_messages` now:
  - Fetches distance alongside each chunk (`<=>` cosine distance)
  - Filters out chunks below the similarity threshold (Python post-filter)
  - Truncates joined context to `context_budget` chars at a word boundary

---

## Frontend

### `src/lib/chat-config.ts`
- New `RagConfig` interface with 5 fields
- `DEFAULT_RAG_CONFIG` and `RAG_CONFIG_LIMITS` constants
- `RAG_STORAGE_KEY` for localStorage persistence

### `src/components/playground/chat-config-context.tsx`
- `ragConfig` state + `updateRagConfig` dispatcher added to context
- `ragConfigRef` — a ref that always tracks current ragConfig so the memoized `onFileSelected` callback reads the latest values without re-creating
- `RagHandlers.uploadFile` signature updated to `(file, chunkSize, chunkOverlap)`
- Both ingestion params passed to `uploadFile` call from the ref

### `src/lib/hooks/use-chat.ts`
- `UseChatOptions` adds `ragConfig: RagConfig`
- `uploadFile(convId, file, chunkSize?, chunkOverlap?)` — appends `?chunk_size=&chunk_overlap=` to the fetch URL
- `uploadFiles` passes chunk params through
- `sendMessage` body includes `top_k`, `similarity_threshold`, `context_budget`

### `src/components/playground/chat-workspace.tsx`
- Pulls `ragConfig` from `useChatConfig()`
- Passes it to `useChat()`
- `registerRagHandlers.uploadFile` now forwards chunk params: `uploadFile(convId, file, chunkSize, chunkOverlap)`

### `src/app/api/conversations/[id]/documents/route.ts`
- POST handler reads `chunk_size` and `chunk_overlap` from the incoming URL's search params
- Appends them to the backend fetch URL so FastAPI receives them as query params

### `src/components/playground/right-sidebar.tsx`
- New `ParamSlider` component with HelpCircle tooltip (what / low / high guidance)
- **Ingestion section** (Database icon):
  - Chunk size slider (100–2000 chars)
  - Chunk overlap slider (0 – `chunk_size-1` chars, dynamically capped)
  - Locks with a padlock badge once documents are uploaded; tooltip explains why
- **Retrieval section** (Search icon):
  - Top-K results (1–10)
  - Min. similarity (0.00–1.00; displays "off" at 0)
  - Context budget (200–4 000 chars)
- All sliders wrapped in `TooltipProvider` using the existing shadcn Tooltip
- `no-scale` class on sliders to suppress the global hover-scale animation

---

## Drop-in instructions

```
forge-rag-params/
├── backend/
│   ├── rag_worker.py          → replace app/rag_worker.py
│   └── routes/
│       ├── documents.py       → replace app/routes/documents.py
│       └── inference.py       → replace app/routes/inference.py
└── src/
    └── src/
        ├── lib/
        │   ├── chat-config.ts                       → replace
        │   └── hooks/use-chat.ts                    → replace
        ├── components/playground/
        │   ├── chat-config-context.tsx              → replace
        │   ├── chat-workspace.tsx                   → replace
        │   └── right-sidebar.tsx                    → replace
        └── app/api/conversations/[id]/documents/
            └── route.ts                             → replace
```

No new npm/pip packages required. No DB migrations required.
