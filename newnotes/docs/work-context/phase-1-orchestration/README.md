# Phase 1: RAG Foundation - Orchestration

**Orchestrator:** Main Claude instance
**Communication:** Filesystem-based (subagents read/write to this directory)

## Objective

Implement Phase 1 baseline: Embeddings generation + hybrid search capability

## Task Sequence

### Task 1: Python Embeddings Service
**Subagent:** python-embeddings-builder
**Input:** personal-assistant-implementation-plan.md (Phase 1.1 section)
**Output:** `task-1-complete.md`
**Deliverable:**
- FastAPI service at `/embeddings-service`
- Dockerfile for GPU support
- API endpoint: POST /api/embeddings/generate

### Task 2: NestJS Embedding Module
**Subagent:** nestjs-embeddings-builder
**Input:**
- personal-assistant-implementation-plan.md (Phase 1.2 section)
- `task-1-complete.md` (API contract from Task 1)
**Output:** `task-2-complete.md`
**Deliverable:**
- EmbeddingsModule at `backend/src/features/embeddings`
- Event listener for note.created
- Repository for note_embeddings table
- Service to call Python API

### Task 3: Hybrid Search API
**Subagent:** nestjs-search-builder
**Input:**
- personal-assistant-implementation-plan.md (Phase 1.3 section)
- `task-2-complete.md` (Embeddings module details)
**Output:** `task-3-complete.md`
**Deliverable:**
- SearchModule at `backend/src/features/search`
- Endpoints: /api/search/semantic, /api/search/keyword, /api/search
- pgvector integration for cosine similarity

### Task 4: Frontend Search UI
**Subagent:** angular-search-builder
**Input:**
- personal-assistant-implementation-plan.md (Phase 1.4 section)
- `task-3-complete.md` (Search API contract)
**Output:** `task-4-complete.md`
**Deliverable:**
- SearchComponent at `frontend/src/app/features/search`
- SearchApiService
- Route: /search

## Status

- [ ] Task 1: Python Embeddings Service
- [ ] Task 2: NestJS Embedding Module
- [ ] Task 3: Hybrid Search API
- [ ] Task 4: Frontend Search UI

## Notes

Each subagent should:
1. Read the plan and any previous task outputs
2. Implement the feature with TDD approach
3. Write a SHORT summary in their output file
4. Mark their task complete

Orchestrator will launch tasks sequentially and verify completion before proceeding.
