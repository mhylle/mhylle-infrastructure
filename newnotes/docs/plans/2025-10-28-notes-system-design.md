# Notes System Design

**Project**: Personal AI-Powered Note-Taking System
**Date**: 2025-10-28
**Target Deployment**: mhylle.com/notes
**Phase**: 1-3 (Foundation + LLM-Powered Task Agent)

## Overview

This system transforms raw text notes into actionable tasks using local AI processing. A modular monolith architecture provides clean separation while maintaining deployment simplicity. The design enables future extraction to microservices without rewrites.

## Architecture

### System Components

**Single NestJS Application** with distinct modules:
- API Module: REST endpoints for frontend
- Ingestion Module: Note validation and persistence
- Task Agent Module: AI-powered task extraction
- LLM Service Module: Ollama abstraction layer
- Shared Module: Entities, DTOs, events

**Communication Pattern**: Redis Pub/Sub decouples modules through events. The ingestion module publishes NOTE_CREATED events; the task agent subscribes and processes.

**Technology Stack**:
- Backend: NestJS 11, TypeORM, PostgreSQL
- Frontend: Angular 20, Material Design
- AI: Ollama (DeepSeek-R1:32B on localhost)
- Message Bus: Redis Pub/Sub
- Deployment: Docker Compose, GitHub Actions

### Integration with Existing Infrastructure

The system integrates with mhylle.com infrastructure following the example-app2 pattern:

- Route: `/notes/` (frontend), `/api/notes/` (backend)
- Database: `notes_db` in shared `mhylle-postgres` container
- Redis: Shared `mhylle-redis` instance for Pub/Sub
- Network: `notes-network` (internal) + `mhylle-network` (shared)
- SSL: Let's Encrypt certificates via nginx reverse proxy

Nginx strips the `/api/notes` prefix before forwarding requests to the backend container.

## Project Structure

### Backend (core/features/shared pattern)

```
backend/src/
├── core/                      # Singleton services
│   ├── database/              # TypeORM configuration
│   ├── redis/                 # Pub/Sub client
│   ├── config/                # Environment config
│   └── health/                # Health endpoints
├── features/                  # Business logic
│   ├── notes/                 # Note CRUD and API
│   ├── task-agent/            # Task extraction
│   └── llm-service/           # AI provider abstraction
│       ├── services/
│       │   ├── local-model.service.ts
│       │   └── ai-provider.interface.ts
│       └── prompts/
│           └── task-extraction.prompt.ts
└── shared/                    # Cross-cutting
    ├── entities/              # Note, Task entities
    ├── dto/                   # Data transfer objects
    ├── events/                # Event definitions
    └── utils/                 # Helper functions
```

### Frontend (component-first pattern)

```
frontend/src/app/
├── core/                      # Singletons
│   ├── auth/                  # Guards, interceptors
│   └── services/              # Core services
├── features/                  # Smart components
│   ├── notes/
│   │   ├── components/
│   │   ├── services/
│   │   └── models/
│   └── tasks/
│       ├── components/
│       ├── services/
│       └── models/
└── shared/                    # Dumb components
    ├── components/
    ├── pipes/
    └── directives/
```

## Frontend Component Design

### Component Architecture

The Angular frontend uses a feature-based structure with three primary components for note management:

#### Note List Component

**Purpose**: Display all notes in a scrollable card-based layout.

**Features**:
- Card-based display with note preview (first 200 characters)
- Creation date timestamp
- Edit button for direct navigation to editor
- Click-to-view interaction (card click opens detail view)
- Create new note button

**Navigation**:
- Card click → Navigate to `/notes/:id` (detail view)
- Edit button → Navigate to `/notes/edit/:id` (edit mode)
- Create button → Navigate to `/notes/new` (create mode)

#### Note Editor Component

**Purpose**: Create new notes or edit existing notes.

**Modes**:

1. **Create Mode** (route: `/notes/new`)
   - Empty editor
   - "Create Note" title
   - Calls `POST /api/notes` on save
   - Redirects to list on success

2. **Edit Mode** (route: `/notes/edit/:id`)
   - Loads existing note content via `GET /api/notes/:id`
   - "Edit Note" title
   - Calls `PATCH /api/notes/:id` on save
   - Redirects to detail view or list on success

**State Management**:
- Detects mode from route parameter (`:id` present = edit mode)
- Loads note data in edit mode during `ngOnInit`
- Displays loading state while fetching note
- Shows error state if note not found

**Validation**:
- Minimum content length: 1 character
- Maximum content length: 10,000 characters
- Trims whitespace before submission

#### Note Detail Component

**Purpose**: Display full note content in read-only mode with metadata and actions.

**Layout**:
```
┌─────────────────────────────────────┐
│ Note Detail                    [×]  │
├─────────────────────────────────────┤
│                                     │
│ Full note content displayed here    │
│ (no truncation)                     │
│                                     │
├─────────────────────────────────────┤
│ Metadata:                           │
│ Created: Oct 28, 2025 10:30 AM     │
│ Updated: Oct 30, 2025 2:15 PM      │
│ Source: text                        │
│ Tasks: 3 extracted                  │
├─────────────────────────────────────┤
│ [Edit] [Delete] [Back to List]     │
└─────────────────────────────────────┘
```

**Data Display**:
- Full note content (no truncation)
- Creation timestamp
- Last update timestamp
- Source type (text, voice, etc.)
- Task count (if tasks extracted)

**Actions**:
- **Edit Button**: Navigate to `/notes/edit/:id`
- **Delete Button**: Confirmation dialog → `DELETE /api/notes/:id` → Navigate to list
- **Back Button**: Navigate to `/notes` (list view)

**Route**: `/notes/:id`

**Error Handling**:
- 404 Not Found → Display "Note not found" message with back button
- Network errors → Display error message with retry button

## User Flows

### Create Note Flow

```
List View (/notes)
    ↓ [Click "Create Note"]
Editor - Create Mode (/notes/new)
    ↓ [Enter content & Save]
API Call: POST /notes
    ↓ [Success]
List View (/notes) - Shows new note
```

### View Note Flow

```
List View (/notes)
    ↓ [Click note card]
Detail View (/notes/:id)
    ↓ [Load note via GET /notes/:id]
Display full content + metadata
    ↓ [User options]
    ├─ [Edit] → Editor - Edit Mode
    ├─ [Delete] → Confirm → List View
    └─ [Back] → List View
```

### Edit Note Flow

```
Detail View (/notes/:id)
    ↓ [Click "Edit"]
Editor - Edit Mode (/notes/edit/:id)
    ↓ [Load note via GET /notes/:id]
    ↓ [Modify content & Save]
API Call: PATCH /notes/:id
    ↓ [Success]
Detail View (/notes/:id) - Shows updated content
```

**Alternative Edit Path**:
```
List View (/notes)
    ↓ [Click "Edit" button on card]
Editor - Edit Mode (/notes/edit/:id)
    ↓ [Direct navigation, skips detail view]
```

### Delete Note Flow

```
Detail View (/notes/:id)
    ↓ [Click "Delete"]
Confirmation Dialog
    ↓ [Confirm]
API Call: DELETE /notes/:id
    ↓ [Success]
List View (/notes) - Note removed
```

### Navigation Matrix

| From State | Action | To State | API Call |
|------------|--------|----------|----------|
| List | Click card | Detail | GET /notes/:id |
| List | Click "Edit" | Editor (edit) | GET /notes/:id |
| List | Click "Create" | Editor (create) | None |
| Detail | Click "Edit" | Editor (edit) | None (already loaded) |
| Detail | Click "Delete" | List | DELETE /notes/:id |
| Detail | Click "Back" | List | None |
| Editor (create) | Save | List | POST /notes |
| Editor (edit) | Save | Detail | PATCH /notes/:id |
| Editor | Cancel | Previous route | None |

## Data Model

### Notes Table

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  source VARCHAR(50) DEFAULT 'text'
);
```

### Tasks Table

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'medium',
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  llm_confidence FLOAT,
  metadata JSONB
);
```

Both tables use JSONB metadata for extension without schema changes. The tasks table includes `llm_confidence` to track AI extraction quality.

## Event-Driven Communication

### Redis Pub/Sub Flow

```
User submits note → Notes API → Save to DB → Publish NOTE_CREATED
                                                    ↓
                                      Task Agent subscribes → Process
```

### Event Definitions

**NoteCreatedEvent**:
```typescript
{
  noteId: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}
```

**TaskCreatedEvent**:
```typescript
{
  taskId: string;
  noteId: string;
  title: string;
  confidence: number;
  timestamp: Date;
}
```

Events use namespaced channels: `notes:created`, `tasks:created`. This pattern prevents collision and enables filtering.

## LLM Integration

### Configuration

The system uses Ollama running on the host machine at `localhost:11434`. Docker containers access it via `host.docker.internal`.

**Environment Variables**:
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=deepseek-r1:32b
OLLAMA_TIMEOUT=60000
```

### Provider Pattern

The LLM service abstracts AI providers behind a unified interface:

```typescript
interface IAIProvider {
  generateCompletion(request: AIGenerationRequest): Promise<AIGenerationResponse>;
  healthCheck(): Promise<boolean>;
  getProviderName(): string;
  getDefaultConfig(): AIProviderConfig;
}
```

This design enables swapping Ollama for OpenAI, Gemini, or Claude by changing a single environment variable.

### Task Extraction Prompt

The system sends notes to DeepSeek-R1 with a structured prompt requesting JSON output:

```typescript
{
  "tasks": [
    {
      "title": "brief task description",
      "description": "detailed context",
      "priority": "low|medium|high",
      "dueDate": "ISO date or null",
      "confidence": 0.0-1.0
    }
  ]
}
```

DeepSeek-R1's reasoning capabilities ensure high-quality extraction with accurate confidence scores.

## Deployment

### Docker Compose Services

```yaml
notes-frontend:
  image: ghcr.io/mhylle/mhylle-notes-frontend:latest
  container_name: notes-frontend
  ports: ["3003:80"]
  networks: [notes-network, mhylle-network]

notes-backend:
  image: ghcr.io/mhylle/mhylle-notes-backend:latest
  container_name: notes-backend
  ports: ["8003:3000"]
  environment:
    - OLLAMA_URL=http://host.docker.internal:11434
    - REDIS_HOST=mhylle-redis
    - DB_HOST=mhylle-postgres
  extra_hosts:
    - "host.docker.internal:host-gateway"
  networks: [notes-network, mhylle-network]
```

### Nginx Routing

```nginx
location /notes/ {
    proxy_pass http://notes-frontend:80/;
}

location /api/notes/ {
    rewrite ^/api/notes/(.*)$ /$1 break;
    proxy_pass http://notes-backend:3000;
    proxy_read_timeout 120s;  # Extended for AI processing
}
```

### CI/CD Pipeline

GitHub Actions builds and deploys on push to main:
1. Build frontend and backend Docker images
2. Push to GitHub Container Registry
3. SSH to server and pull latest images
4. Restart containers with health checks
5. Verify deployment via health endpoints

## Implementation Phases

### Phase 1: Foundation (Week 1)

Build the core infrastructure:
- NestJS backend with TypeORM and PostgreSQL
- Database migrations following example-app2 pattern
- Basic CRUD API for notes
- Angular frontend with note list and editor
- Docker configuration and deployment

**Success Criteria**: Create and list notes via frontend, data persists in PostgreSQL.

### Phase 2: Event System (Week 2)

Add event-driven architecture:
- Redis module with Pub/Sub client
- Event definitions and publishing
- Monitoring and error handling
- Integration testing

**Success Criteria**: NOTE_CREATED events publish to Redis, system remains stable if Redis fails.

### Phase 3: LLM Task Agent (Week 3-4)

Implement AI-powered task extraction:
- Ollama provider with health checks
- Task agent subscribing to NOTE_CREATED
- Task extraction prompt and parsing
- Task CRUD API and frontend display
- Confidence-based filtering

**Success Criteria**: Tasks extract automatically from notes with high accuracy, frontend displays tasks with status management.

## Testing Strategy

### Backend Testing

**Unit Tests**: Each service in isolation with mocked dependencies.

**Integration Tests**: API endpoints with real database (test container).

**E2E Tests**: Full flow from note creation to task extraction.

### Frontend Testing

**Component Tests**: Angular components with mocked services.

**E2E Tests**: Playwright scenarios covering user workflows.

Example E2E test:
```typescript
test('extract tasks from note', async ({ page }) => {
  await page.goto('/notes');
  await page.fill('textarea', 'Buy groceries tomorrow');
  await page.click('button:has-text("Save")');
  await page.click('a:has-text("Tasks")');
  await expect(page.locator('text=buy groceries')).toBeVisible();
});
```

## Monitoring

### Health Checks

- Frontend: `GET /`
- Backend: `GET /health`, `GET /api/notes/health`
- Ollama: Service validates model availability on startup

### Logging

Structured logging follows the mynotes pattern using Winston. All errors include context: request ID, user action, module name.

### Metrics

Track these indicators:
- Note creation rate
- Task extraction success rate
- LLM response time (p50, p95, p99)
- Redis connection health

## Future Enhancements

### Phase 4: Additional Agents

- Entity Agent: Extract people, places, projects
- Calendar Agent: Detect events and dates

### Phase 5: RAG with Vector Search

- Enable pgvector extension
- Generate embeddings for notes and tasks
- Implement semantic search
- Context-aware task updates (merge vs. create)

The current database schema prepares for this by including JSONB metadata fields and designing for extension.

## Security Considerations

- PostgreSQL accessible only within Docker network
- Redis requires no authentication (internal network)
- Ollama runs on localhost, unreachable from internet
- SSL/TLS enforced via nginx with Let's Encrypt
- Auth integration via existing auth-proxy pattern
- Cookie-based authentication with HTTP-only, secure flags

## Performance Targets

- API Response: <200ms (excluding LLM processing)
- LLM Processing: <10s for task extraction
- Frontend Load: <3s on 3G networks
- Database Queries: <50ms (95th percentile)

DeepSeek-R1:32B requires significant compute. Monitor inference time and consider smaller models if response time exceeds targets.
