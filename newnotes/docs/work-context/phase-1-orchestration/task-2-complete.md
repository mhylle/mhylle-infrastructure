# Task 2 Complete: NestJS Embeddings Module

## Summary
NestJS embeddings module implemented with Redis event listener, PostgreSQL storage with pgvector, and integration with Python embeddings service.

## Deliverables

### 1. Module Structure
**Location:** `/backend/src/features/embeddings/`

**Files Created:**
- `embeddings.module.ts` - Module configuration
- `entities/note-embedding.entity.ts` - TypeORM entity
- `repositories/note-embedding.repository.ts` - Database repository
- `services/embeddings.service.ts` - Embeddings API client
- `services/embeddings-migration.service.ts` - Database schema migration
- `listeners/note-embedding.listener.ts` - Redis event subscriber
- `dto/embedding.dto.ts` - Data transfer objects
- `services/embeddings.service.spec.ts` - Service tests
- `listeners/note-embedding.listener.spec.ts` - Listener tests

### 2. Database Schema

**Entity:** `NoteEmbedding`
```typescript
- id: UUID (primary key)
- noteId: UUID (foreign key to notes)
- embedding: vector(384) (pgvector type)
- model: string (model name)
- createdAt: timestamp
- UNIQUE constraint on (noteId, model)
```

**Indexes:**
- Unique index on (noteId, model)
- ivfflat index on embedding for cosine similarity
- Index on noteId for lookups

### 3. Migration System

**Auto-Migration Service:** `EmbeddingsMigrationService`
- Runs on module initialization (OnModuleInit)
- Enables pgvector extension
- Creates note_embeddings table if not exists
- Creates ivfflat index for vector similarity search
- Idempotent - safe to run multiple times

### 4. Embeddings Service

**Features:**
- HTTP client to Python embeddings API
- Single and batch embedding generation
- Automatic storage with upsert logic
- Health check endpoint integration
- Comprehensive error handling and logging

**Configuration:**
- API URL: `http://embeddings-service:8001` (Docker network)
- Timeout: 30 seconds
- Default model: `all-MiniLM-L6-v2`

### 5. Event Integration

**Redis Event Listener:** `NoteEmbeddingListener`
- Subscribes to `note.created` events on module init
- Processes note content for embedding generation
- Non-blocking - errors don't prevent note creation
- Uses rawContent when available, falls back to content
- Comprehensive logging for observability

**Event Flow:**
```
Note Created → Redis NOTE_CREATED event
→ NoteEmbeddingListener receives event
→ EmbeddingsService calls Python API
→ NoteEmbeddingRepository stores in PostgreSQL
→ pgvector stores 384-dim embedding
```

### 6. Repository Operations

**Methods:**
- `save(noteId, embedding, model)` - Create new embedding
- `findByNoteId(noteId)` - Get all embeddings for note
- `findByNoteIdAndModel(noteId, model)` - Get specific embedding
- `deleteByNoteId(noteId)` - Remove all embeddings for note
- `upsert(noteId, embedding, model)` - Create or update embedding

### 7. Test Coverage

**Service Tests (embeddings.service.spec.ts):**
- Single embedding generation
- Batch embedding generation
- Generate and store workflow
- Delete embedding
- Health check
- Error handling

**Listener Tests (note-embedding.listener.spec.ts):**
- Redis subscription setup
- Event processing
- Fallback to content when rawContent missing
- Graceful error handling
- Invalid event handling

**Total Tests:** 13

### 8. Integration with App Module

Updated `app.module.ts` to import `EmbeddingsModule`:
- Module registered in imports array
- Available throughout application
- Listeners activated on startup

## API Contract for Task 3

The embeddings module exposes the following for search integration:

### Repository Access
```typescript
@Injectable()
export class NoteEmbeddingRepository {
  async findByNoteId(noteId: string): Promise<NoteEmbedding[]>
  async findByNoteIdAndModel(noteId, model): Promise<NoteEmbedding | null>
}
```

### Entity Structure
```typescript
class NoteEmbedding {
  id: string;
  noteId: string;
  embedding: number[];  // 384 dimensions
  model: string;
  createdAt: Date;
}
```

### Database Queries
Task 3 can perform vector similarity searches using:
```sql
SELECT
  n.*,
  1 - (ne.embedding <=> query_embedding) as similarity
FROM notes n
JOIN note_embeddings ne ON n.id = ne."noteId"
WHERE ne.model = 'all-MiniLM-L6-v2'
ORDER BY ne.embedding <=> query_embedding
LIMIT 10
```

Where `<=>` is the pgvector cosine distance operator.

## Technical Details

### Vector Storage
- Type: `vector(384)` via pgvector extension
- Dimension: 384 (all-MiniLM-L6-v2)
- Index: ivfflat with dynamic list sizing
- Distance metric: Cosine distance

### Error Handling
- API failures logged but don't block note creation
- Migration failures prevent module initialization
- Service health check for monitoring
- Comprehensive error logging with stack traces

### Performance Considerations
- Batch API support for multiple embeddings
- Connection pooling via HttpModule
- ivfflat index for fast similarity search
- 30-second timeout for API calls

## Validation Checklist

✅ EmbeddingsModule created at `/backend/src/features/embeddings`
✅ NoteEmbedding entity with pgvector type
✅ NoteEmbeddingRepository with CRUD operations
✅ EmbeddingsService with API integration
✅ Redis event listener for note.created
✅ Auto-migration service for database schema
✅ Module registered in app.module.ts
✅ Comprehensive test suite (13 tests)
✅ Error handling and logging
✅ Docker network integration configured

## Notes for Task 3 (Hybrid Search API)

1. **Vector Search:** Use pgvector cosine distance operator `<=>` for semantic search
2. **Repository Access:** NoteEmbeddingRepository is exported from module
3. **Embedding Dimension:** Always 384 dimensions for all-MiniLM-L6-v2
4. **Model Filter:** Filter by model='all-MiniLM-L6-v2' in queries
5. **Hybrid Approach:** Combine vector similarity with PostgreSQL full-text search
6. **ivfflat Index:** Already created, optimized for cosine similarity searches

## Next Steps
Task 3 should implement SearchModule that:
1. Creates `/api/search/semantic` endpoint using pgvector cosine similarity
2. Creates `/api/search/keyword` endpoint using PostgreSQL full-text search
3. Creates `/api/search` endpoint combining both (hybrid search)
4. Returns results with relevance scores
5. Handles pagination and filtering
