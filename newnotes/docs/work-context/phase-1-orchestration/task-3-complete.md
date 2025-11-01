# Task 3 Complete: Hybrid Search API

## Summary
NestJS hybrid search API implemented with semantic vector search, keyword full-text search, and intelligent score combination.

## Deliverables

### 1. Module Structure
**Location:** `/backend/src/features/search/`

**Files Created:**
- `search.module.ts` - Module configuration
- `controllers/search.controller.ts` - REST API endpoints
- `services/search.service.ts` - Search logic implementation
- `dto/search.dto.ts` - Request/response DTOs
- `services/search.service.spec.ts` - Comprehensive tests

### 2. API Endpoints

#### Semantic Search
**Endpoint:** `GET /api/search/semantic`
**Query Parameters:**
- `query` (required): Search query string
- `limit` (optional): Max results (1-100, default: 10)
- `minScore` (optional): Minimum similarity score (0.0-1.0, default: 0.0)

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Note title",
      "content": "Full content",
      "snippet": "First 200 characters...",
      "score": 0.85,
      "searchType": "semantic",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "query": "docker best practices",
  "mode": "semantic",
  "totalResults": 5,
  "processingTimeMs": 45
}
```

#### Keyword Search
**Endpoint:** `GET /api/search/keyword`
**Query Parameters:** Same as semantic search

**Response:** Same structure, but:
- Uses PostgreSQL `ts_rank` for scoring
- Snippet is highlighted with `ts_headline`
- searchType: "keyword"

#### Hybrid Search
**Endpoint:** `GET /api/search`
**Query Parameters:**
- `query` (required): Search query string
- `mode` (optional): "semantic" | "keyword" | "hybrid" (default: "hybrid")
- `limit` (optional): Max results (1-100, default: 10)
- `minScore` (optional): Minimum score (0.0-1.0, default: 0.0)

**Response:** Same structure
- Combines semantic (70% weight) + keyword (30% weight)
- Deduplicates results
- Uses keyword snippet for better highlighting
- searchType: "hybrid"

### 3. Search Implementation

#### Semantic Search Algorithm
1. Generate query embedding via `EmbeddingsService`
2. Use pgvector cosine distance operator `<=>`
3. Calculate similarity: `1 - (embedding <=> query_embedding)`
4. Join with notes table
5. Filter by model and minimum score
6. Order by distance (closest first)
7. Limit results

**SQL:**
```sql
SELECT n.*, 1 - (ne.embedding <=> $1::vector) as score
FROM notes n
JOIN note_embeddings ne ON n.id = ne."noteId"
WHERE ne.model = 'all-MiniLM-L6-v2'
  AND (1 - (ne.embedding <=> $1::vector)) >= $2
ORDER BY ne.embedding <=> $1::vector
LIMIT $3
```

#### Keyword Search Algorithm
1. Convert query to `plainto_tsquery`
2. Match against `to_tsvector` of title + content
3. Calculate relevance with `ts_rank`
4. Generate highlighted snippet with `ts_headline`
5. Filter by minimum score
6. Order by relevance (highest first)
7. Limit results

**SQL:**
```sql
SELECT n.*,
  ts_rank(to_tsvector('english', n.title || ' ' || n.content),
    plainto_tsquery('english', $1)) as score,
  ts_headline('english', n.content, plainto_tsquery('english', $1)) as snippet
FROM notes n
WHERE to_tsvector('english', n.title || ' ' || n.content) @@
      plainto_tsquery('english', $1)
  AND score >= $2
ORDER BY score DESC
LIMIT $3
```

#### Hybrid Search Algorithm
1. Execute semantic and keyword searches in parallel
2. Fetch 2x limit from each for better merging
3. Weight semantic results: score * 0.7
4. Weight keyword results: score * 0.3
5. Combine scores for duplicate notes
6. Use keyword snippet (better highlighting)
7. Sort by combined score
8. Filter by minimum score
9. Limit to requested number

**Score Combination:**
- If note appears in both: `semantic_score * 0.7 + keyword_score * 0.3`
- If note appears in semantic only: `semantic_score * 0.7`
- If note appears in keyword only: `keyword_score * 0.3`

### 4. DTOs and Validation

**SearchQueryDto:**
- `query`: Required string
- `mode`: Optional enum (semantic|keyword|hybrid)
- `limit`: Optional number (1-100, default: 10)
- `minScore`: Optional number (0.0-1.0, default: 0.0)

**SearchResultDto:**
- `id`: Note UUID
- `title`: Note title
- `content`: Full content
- `snippet`: Truncated/highlighted content
- `score`: Relevance score (0.0-1.0)
- `searchType`: "semantic" | "keyword" | "hybrid"
- `createdAt`: Creation timestamp
- `updatedAt`: Update timestamp

**SearchResponseDto:**
- `results`: Array of SearchResultDto
- `query`: Original query string
- `mode`: Search mode used
- `totalResults`: Number of results
- `processingTimeMs`: Search duration

### 5. Dependencies

**Modules:**
- `EmbeddingsModule` - For query embedding generation
- `DataSource` (TypeORM) - For raw SQL queries

**Why Raw SQL:**
- pgvector operators not supported in TypeORM query builder
- Full-text search functions require raw SQL
- Performance optimization with direct queries

### 6. Test Coverage

**Tests (search.service.spec.ts):**
- Semantic search execution
- Keyword search execution
- Hybrid search with score combination
- Minimum score filtering
- Result limit enforcement
- Processing time tracking
- Empty results handling
- Score combination in hybrid mode (70/30 split)
- Snippet preference (keyword over semantic)

**Total Tests:** 9

### 7. Integration

**App Module:**
- SearchModule added to imports
- Routes available at `/api/search/*`
- Depends on EmbeddingsModule

## Technical Details

### Performance Optimizations
- Parallel execution of semantic + keyword in hybrid mode
- Fetch 2x limit for better hybrid merging
- ivfflat index for fast vector similarity
- PostgreSQL ts_rank for keyword relevance

### Score Weighting Rationale
- **Semantic (70%):** Better for concept matching and synonyms
- **Keyword (30%):** Better for exact term matches
- Combination provides best of both approaches

### Error Handling
- Empty results return gracefully
- Search failures logged but don't crash
- Falls back to empty array on errors
- Processing time always tracked

## Validation Checklist

✅ SearchModule created at `/backend/src/features/search`
✅ GET /api/search/semantic endpoint
✅ GET /api/search/keyword endpoint
✅ GET /api/search (hybrid) endpoint
✅ pgvector cosine similarity integration
✅ PostgreSQL full-text search integration
✅ Hybrid score combination (70/30 split)
✅ Request validation with DTOs
✅ Comprehensive test suite (9 tests)
✅ Error handling and logging
✅ Module registered in app.module.ts

## API Contract for Task 4

The search API provides these endpoints for frontend integration:

### Base URL
`http://localhost:3000/api/search` (development)

### Semantic Search
```typescript
GET /api/search/semantic?query=docker&limit=10&minScore=0.5

Response: SearchResponseDto {
  results: SearchResultDto[];
  query: string;
  mode: "semantic";
  totalResults: number;
  processingTimeMs: number;
}
```

### Keyword Search
```typescript
GET /api/search/keyword?query=docker&limit=10

Response: SearchResponseDto (same structure, mode: "keyword")
```

### Hybrid Search (Recommended)
```typescript
GET /api/search?query=docker best practices&mode=hybrid&limit=10

Response: SearchResponseDto (mode: "hybrid")
```

### Query Parameters
- `query`: Required - Search query string
- `mode`: Optional - "semantic" | "keyword" | "hybrid" (default: "hybrid")
- `limit`: Optional - 1-100 (default: 10)
- `minScore`: Optional - 0.0-1.0 (default: 0.0)

### Result Format
Each result includes:
- Full note data (id, title, content)
- Snippet (200 chars for semantic, highlighted for keyword)
- Relevance score (0.0-1.0)
- Search type indicator
- Timestamps

## Notes for Task 4 (Frontend Search UI)

1. **Recommended Endpoint:** Use `/api/search` with `mode=hybrid` for best results
2. **Score Display:** Show score as percentage (score * 100)
3. **Snippet Usage:** Display snippet instead of full content in results list
4. **Debouncing:** Debounce search input (300-500ms) to reduce API calls
5. **Loading States:** Show loading indicator during search
6. **Empty States:** Handle zero results gracefully
7. **Error Handling:** Display user-friendly error messages
8. **Pagination:** Use limit parameter for result batching (consider load more vs. pagination)
9. **Mode Selection:** Allow users to toggle between semantic, keyword, and hybrid
10. **Score Threshold:** Consider hiding very low scores (< 0.3) for better UX

## Next Steps
Task 4 should implement Angular SearchComponent that:
1. Creates search input with debouncing
2. Displays results in cards with score indicators
3. Shows loading and empty states
4. Handles navigation to note detail
5. Provides mode toggle (semantic/keyword/hybrid)
6. Implements responsive design
