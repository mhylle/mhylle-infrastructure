# Personal Assistant System - Implementation Plan

**Document Version:** 1.0
**Created:** 2025-01-31
**Status:** Ready for Implementation

## Executive Summary

Transform the existing notes system into a comprehensive personal assistant with:
- **Conversational RAG** for querying your notes
- **Knowledge Graph** for discovering connections
- **Intelligent News System** for automated topic tracking
- **Document Processing** for importing external knowledge
- **Proactive Intelligence** for automatic insights

**Architecture:** Service-oriented with language flexibility (NestJS primary, Python for ML)
**Scope:** Single-user system (no multi-user complexity)
**Development:** Polished incremental releases with MVP → expansion pattern

---

## Architectural Decisions

### Core Principles
1. **Service-Oriented Architecture** - Mix and match languages as needed
2. **Event-Driven Design** - Loose coupling via Redis Pub/Sub
3. **Separation of Concerns** - Each service has clear responsibility
4. **MVP-First** - Simple baseline → iterative expansion
5. **No Auth Until Production** - Simplify development, add auth at deployment

### Technology Stack

**Backend Services:**
- **Primary:** NestJS 11 (TypeScript) - Notes, Chat, News, Tasks
- **ML Service:** Python + FastAPI - Embeddings generation
- **Database:** PostgreSQL 17 + pgvector - Shared database, API boundaries
- **Events:** Redis Pub/Sub - Async communication
- **LLM:** Ollama + DeepSeek-R1 (RTX 3090)
- **Search:** Tavily API - Web search & news aggregation

**Frontend:**
- **Framework:** Angular 20 (standalone components)
- **UI:** Material Design 3
- **State:** Signals + computed()

**Infrastructure:**
- **Orchestration:** Docker Compose - Service discovery
- **Scheduling:** Bull Queue (Redis-backed) - Cron jobs with persistence
- **Storage:** Database blobs - Document storage

### Service Communication

**Hybrid Pattern:**
- **Synchronous (REST):** Request-response queries (e.g., "get embedding")
- **Asynchronous (Events):** Fire-and-forget notifications (e.g., "note created")

**Service Discovery:** Docker Compose service names
```yaml
# Services can call each other by name
http://embeddings-service:8001/api/embeddings
http://notes-service:3005/api/notes
```

### Database Strategy

**Shared PostgreSQL with API Boundaries:**
- All services use same database
- Services only access their tables via APIs (no direct cross-service queries)
- Can evolve to separate databases if needed

**Schemas:**
```
public (default):
- notes, tasks, note_embeddings, note_relationships
- chat_sessions, chat_messages
- user_interests, topic_subscriptions, news_items
- documents
```

### Error Handling & Resilience

**External Service Failures:**
1. **Tavily API Down:** Show cached news with timestamp
2. **Embeddings Service Down:** Queue events for retry, show warning to user
3. **LLM Poor Response:** Display confidence scores + raw sources

**Retry Strategy:**
- Bull Queue with exponential backoff
- Max retries: 3
- Dead letter queue for manual inspection

---

## Phase-by-Phase Implementation

### Phase 1: Conversational RAG Foundation (Weeks 1-3)

**Goal:** Enable natural language Q&A with your notes

#### MVP Baseline (Week 1-2):

**1.1: Python Embeddings Service**
```python
# FastAPI service
POST /api/embeddings/generate
{
  "text": "note content",
  "model": "all-MiniLM-L6-v2"
}

Response:
{
  "embedding": [0.123, -0.456, ...],  # 384 dimensions
  "model": "all-MiniLM-L6-v2"
}
```

**Tech:**
- FastAPI framework
- Sentence Transformers library
- GPU acceleration (RTX 3090)
- Docker container

**1.2: Embedding Generation Listener**
```typescript
// NestJS listener
@OnEvent('note.created')
async handleNoteCreated(event: NoteCreatedEvent) {
  // Call Python service
  const embedding = await embeddingsService.generate(event.content)

  // Store in PostgreSQL
  await embeddingsRepo.save({
    noteId: event.noteId,
    embedding,
    model: 'all-MiniLM-L6-v2'
  })
}
```

**1.3: Hybrid Search API**
```typescript
// Semantic search (dense)
GET /api/search/semantic?query=docker best practices

// Keyword search (sparse)
GET /api/search/keyword?query=docker

// Combined search
GET /api/search?query=docker&mode=hybrid
```

**Database Schema:**
```sql
CREATE TABLE note_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  embedding vector(384),  -- MiniLM dimension
  model VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(note_id, model)
);

CREATE INDEX ON note_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON note_embeddings(note_id);
```

**1.4: Simple Search UI**
```typescript
// Angular component
@Component({
  selector: 'app-search',
  template: `
    <mat-form-field>
      <input matInput placeholder="Search your notes..."
             [(ngModel)]="query" (keyup.enter)="search()">
    </mat-form-field>

    <div *ngFor="let result of results()">
      <mat-card>
        <h3>{{ result.title }}</h3>
        <p>{{ result.snippet }}</p>
        <span>Relevance: {{ result.score | percent }}</span>
      </mat-card>
    </div>
  `
})
export class SearchComponent {
  query = signal('');
  results = signal<SearchResult[]>([]);
}
```

**Events:**
```typescript
NoteCreatedEvent → EmbeddingGenerationListener
NoteUpdatedEvent → EmbeddingUpdateListener
NoteDeletedEvent → EmbeddingCleanupListener
```

**Testing:**
- Unit tests: Embedding generation, similarity calculation
- Integration: Note → Embedding pipeline
- E2E: Create note → Search finds it

**Deliverable:** Type question, get relevant notes with relevance scores

---

#### Expansion (Phase 1.5 - Week 3):

**1.5: Advanced Search Features**
- Filter by date range, tags, note type
- Sort by relevance, recency, or combined
- Pagination for large result sets
- Search history

---

### Phase 2: Conversational AI (Weeks 4-6)

**Goal:** Multi-turn conversations with context management

#### MVP Baseline (Week 4-5):

**2.1: Chat Session Management**
```typescript
// API endpoints
POST /api/chat/sessions           // Create new chat
GET /api/chat/sessions             // List all chats
GET /api/chat/sessions/:id         // Get chat with history
DELETE /api/chat/sessions/:id      // Delete chat
POST /api/chat/sessions/:id/messages  // Send message
```

**Database Schema:**
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL,
  sources JSONB,  -- [{ note_id, title, relevance_score }]
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON chat_messages(session_id, created_at);
```

**2.2: RAG Service**
```typescript
class RAGService {
  async query(query: string, sessionId: string): Observable<string> {
    // 1. Retrieve relevant notes
    const notes = await this.semanticSearch(query, limit: 5);

    // 2. Build context from conversation history
    const history = await this.chatService.getHistory(sessionId, limit: 10);

    // 3. Construct prompt
    const prompt = this.buildPrompt(query, notes, history);

    // 4. Stream LLM response
    return this.ollamaService.generate(prompt, { stream: true });
  }

  private buildPrompt(query: string, notes: Note[], history: Message[]): string {
    return `
You are a helpful assistant with access to the user's personal notes.

Relevant Notes:
${notes.map(n => `[${n.title}]\n${n.content}`).join('\n\n')}

Conversation History:
${history.map(m => `${m.role}: ${m.content}`).join('\n')}

User Question: ${query}

Provide a helpful answer based on the notes. If the notes don't contain the answer, say so.
Cite which notes you used.
    `;
  }
}
```

**2.3: Chat UI Component**
```typescript
@Component({
  selector: 'app-chat',
  template: `
    <div class="chat-container">
      <!-- Session sidebar -->
      <mat-drawer-container>
        <mat-drawer mode="side" opened>
          <h3>Chat Sessions</h3>
          <mat-list>
            <mat-list-item *ngFor="let session of sessions()">
              {{ session.title }}
            </mat-list-item>
          </mat-list>
          <button mat-fab (click)="newSession()">
            <mat-icon>add</mat-icon>
          </button>
        </mat-drawer>

        <!-- Messages -->
        <mat-drawer-content>
          <div class="messages">
            <div *ngFor="let msg of messages()"
                 [class.user]="msg.role === 'user'"
                 [class.assistant]="msg.role === 'assistant'">
              <div class="content">{{ msg.content }}</div>
              <div *ngIf="msg.sources" class="sources">
                Sources:
                <a *ngFor="let src of msg.sources"
                   [routerLink]="['/notes', src.note_id]">
                  {{ src.title }}
                </a>
              </div>
            </div>
          </div>

          <!-- Input -->
          <mat-form-field>
            <input matInput [(ngModel)]="input"
                   (keyup.enter)="send()"
                   placeholder="Ask a question...">
          </mat-form-field>
        </mat-drawer-content>
      </mat-drawer-container>
    </div>
  `
})
export class ChatComponent {
  sessions = signal<ChatSession[]>([]);
  messages = signal<ChatMessage[]>([]);
  input = signal('');

  send() {
    const query = this.input();
    this.chatService.sendMessage(this.currentSession.id, query)
      .subscribe(response => {
        this.messages.update(msgs => [...msgs, {
          role: 'assistant',
          content: response.content,
          sources: response.sources
        }]);
      });
  }
}
```

**Events:**
```typescript
ChatMessageSentEvent → RAGRetrievalService → LLMService
ChatSessionCreatedEvent → SessionInitializedEvent
```

**Testing:**
- Unit: RAG context building, prompt generation
- Integration: Search → LLM → Response
- E2E: Multi-turn conversation maintains context

**Deliverable:** Chat interface with conversation history and source citations

---

#### Expansion (Phase 2.5 - Week 6):

**2.6: Web Search Fallback**
```typescript
async query(query: string): Promise<Response> {
  // Try notes first
  const notes = await this.semanticSearch(query);

  if (notes.length === 0 || maxScore < 0.6) {
    // Fallback to web search
    const webResults = await this.tavilyService.search(query);
    return {
      content: this.summarizeWebResults(webResults),
      sources: webResults.map(r => ({ url: r.url, title: r.title })),
      fallback: true
    };
  }

  return this.generateFromNotes(notes);
}
```

**2.7: Confidence Scoring**
- Display confidence in answer quality
- Warn user if low confidence
- Offer alternative search strategies

**2.8: Clarifying Questions**
```typescript
if (query.isAmbiguous) {
  return {
    type: 'clarification',
    question: 'Did you mean X or Y?',
    options: ['X', 'Y']
  };
}
```

---

### Phase 3: Knowledge Graph & Relationships (Weeks 7-9)

**Goal:** Connect and visualize related notes

#### MVP Baseline (Week 7-8):

**3.1: Automatic Similarity Detection**
```typescript
// Scheduled job (nightly)
@Cron('0 2 * * *')  // 2 AM daily
async detectRelationships() {
  const notes = await this.notesRepo.findAll();

  for (const note of notes) {
    // Find similar notes via embedding cosine similarity
    const similar = await this.embeddingsRepo.findSimilar(
      note.id,
      threshold: 0.7,
      limit: 10
    );

    for (const match of similar) {
      await this.relationshipsRepo.upsert({
        sourceNoteId: note.id,
        targetNoteId: match.id,
        type: 'semantic',
        confidence: match.similarity,
        metadata: { algorithm: 'cosine', model: 'minilm' }
      });
    }
  }
}
```

**Database Schema:**
```sql
CREATE TABLE note_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,  -- 'semantic', 'referential', 'causal', 'temporal'
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_note_id, target_note_id, relationship_type)
);

CREATE INDEX ON note_relationships(source_note_id);
CREATE INDEX ON note_relationships(target_note_id);
CREATE INDEX ON note_relationships(confidence);
CREATE INDEX ON note_relationships(relationship_type);
```

**3.2: Manual Wiki-Style Links**
```typescript
// Parse [[note-name]] syntax in note content
class WikiLinkParser {
  parse(content: string): WikiLink[] {
    const regex = /\[\[([^\]]+)\]\]/g;
    const links = [];

    let match;
    while ((match = regex.exec(content)) !== null) {
      links.push({
        text: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    return links;
  }

  async resolveLinks(links: WikiLink[]): Promise<Note[]> {
    // Find notes by title
    return Promise.all(
      links.map(link => this.notesRepo.findByTitle(link.text))
    );
  }
}

// On note save, create bidirectional relationships
@OnEvent('note.saved')
async handleNoteSaved(event: NoteSavedEvent) {
  const links = this.wikiLinkParser.parse(event.content);
  const targetNotes = await this.wikiLinkParser.resolveLinks(links);

  for (const target of targetNotes) {
    // Forward link
    await this.relationshipsRepo.upsert({
      sourceNoteId: event.noteId,
      targetNoteId: target.id,
      type: 'referential',
      confidence: 1.0,
      metadata: { manual: true }
    });

    // Backward link (backlink)
    await this.relationshipsRepo.upsert({
      sourceNoteId: target.id,
      targetNoteId: event.noteId,
      type: 'referential',
      confidence: 1.0,
      metadata: { manual: true, backlink: true }
    });
  }
}
```

**3.3: Related Notes Widget**
```typescript
@Component({
  selector: 'app-related-notes',
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Related Notes</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <!-- Group by relationship type -->
        <div *ngFor="let group of groupedRelations()">
          <h4>{{ group.type | titlecase }}</h4>
          <mat-chip-listbox>
            <mat-chip-option *ngFor="let rel of group.relations"
                            [routerLink]="['/notes', rel.targetNoteId]">
              {{ rel.targetNote.title }}
              <span class="confidence" *ngIf="rel.confidence < 1.0">
                {{ rel.confidence | percent }}
              </span>
            </mat-chip-option>
          </mat-chip-listbox>
        </div>

        <!-- No relations -->
        <p *ngIf="relations().length === 0" class="muted">
          No related notes found
        </p>
      </mat-card-content>
    </mat-card>
  `
})
export class RelatedNotesComponent {
  @Input() noteId!: string;

  relations = signal<Relationship[]>([]);

  groupedRelations = computed(() => {
    const groups = new Map<string, Relationship[]>();

    for (const rel of this.relations()) {
      if (!groups.has(rel.type)) {
        groups.set(rel.type, []);
      }
      groups.get(rel.type)!.push(rel);
    }

    return Array.from(groups.entries()).map(([type, relations]) => ({
      type,
      relations: relations.sort((a, b) => b.confidence - a.confidence)
    }));
  });

  ngOnInit() {
    this.relationshipsService.getForNote(this.noteId)
      .subscribe(rels => this.relations.set(rels));
  }
}
```

**Events:**
```typescript
NoteCreatedEvent → RelationshipDiscoveryJob (queued for nightly run)
NoteSavedEvent → WikiLinkParserService
RelationshipCreatedEvent → CacheInvalidationService
```

**Testing:**
- Unit: Cosine similarity calculation, wiki link parsing
- Integration: Note creation → Relationship detection
- E2E: Create related notes → Verify links appear

**Deliverable:** Related notes sidebar with confidence scores

---

#### Expansion (Phase 3.5 - Week 9):

**3.6: Graph Visualization**
- D3.js force-directed graph
- Interactive node exploration
- Filter by relationship type
- Zoom and pan

**3.7: Timeline View**
- Temporal relationships
- Show notes created around same time
- Chronological note browser

**3.8: LLM-Detected Causal Relationships**
```typescript
// Use LLM to detect "Note B builds on Note A"
async detectCausalRelationships() {
  const notes = await this.notesRepo.findAll();

  for (const noteA of notes) {
    for (const noteB of notes.filter(n => n.id !== noteA.id)) {
      const prompt = `
Do these notes have a causal relationship? Does Note B build on ideas from Note A?

Note A: ${noteA.content}
Note B: ${noteB.content}

Answer: yes/no and confidence (0-1)
      `;

      const response = await this.llmService.query(prompt);

      if (response.answer === 'yes' && response.confidence > 0.7) {
        await this.relationshipsRepo.create({
          sourceNoteId: noteA.id,
          targetNoteId: noteB.id,
          type: 'causal',
          confidence: response.confidence
        });
      }
    }
  }
}
```

---

### Phase 4: Intelligent News & Interest System (Weeks 10-14)

**Goal:** Automatic interest tracking and morning news digest (6 AM)

#### MVP Baseline (Week 10-13):

**4.1: Interest Detection Service**
```typescript
class InterestDetectionService {
  async detectInterests(): Promise<Interest[]> {
    const interests = [];

    // 1. Analyze note content
    const notes = await this.notesRepo.findRecent(limit: 100);
    const topics = await this.llmService.extractTopics(notes);

    for (const topic of topics) {
      interests.push({
        topic: topic.name,
        confidence: topic.score,
        sourceType: 'notes',
        evidenceCount: topic.noteCount,
        lastSeen: new Date()
      });
    }

    // 2. Analyze search queries
    const searches = await this.searchLogRepo.findRecent(limit: 50);
    const searchTopics = this.extractSearchTopics(searches);

    for (const topic of searchTopics) {
      const existing = interests.find(i => i.topic === topic.name);
      if (existing) {
        existing.confidence = Math.min(1.0, existing.confidence + topic.score * 0.3);
        existing.evidenceCount += topic.count;
      } else {
        interests.push({
          topic: topic.name,
          confidence: topic.score * 0.5,  // Lower weight for searches alone
          sourceType: 'searches',
          evidenceCount: topic.count,
          lastSeen: new Date()
        });
      }
    }

    // 3. Analyze tasks
    const tasks = await this.tasksRepo.findAll();
    const taskTopics = await this.llmService.extractTopics(tasks.map(t => t.title));

    for (const topic of taskTopics) {
      const existing = interests.find(i => i.topic === topic.name);
      if (existing) {
        existing.confidence = Math.min(1.0, existing.confidence + topic.score * 0.2);
        existing.evidenceCount += topic.count;
      } else {
        interests.push({
          topic: topic.name,
          confidence: topic.score * 0.4,
          sourceType: 'tasks',
          evidenceCount: topic.count,
          lastSeen: new Date()
        });
      }
    }

    return interests.filter(i => i.confidence >= 0.7);
  }
}
```

**Database Schema:**
```sql
CREATE TABLE user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(255) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_type VARCHAR(50) NOT NULL,  -- 'notes', 'searches', 'tasks', 'manual'
  evidence_count INTEGER NOT NULL DEFAULT 1,
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(topic)
);

CREATE TABLE interest_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id UUID REFERENCES user_interests(id) ON DELETE CASCADE,
  source_id UUID NOT NULL,  -- note_id, search_id, task_id
  source_type VARCHAR(50) NOT NULL,
  relevance_score DECIMAL(3,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON user_interests(confidence);
CREATE INDEX ON user_interests(last_seen);
CREATE INDEX ON interest_evidence(interest_id);
```

**4.2: Topic Subscription System**
```typescript
// API endpoints
GET /api/interests                    // List detected interests
POST /api/interests/:id/confirm       // Confirm auto-detected
DELETE /api/interests/:id             // Remove interest
POST /api/subscriptions               // Add manual subscription
PATCH /api/subscriptions/:id          // Update frequency
DELETE /api/subscriptions/:id         // Unsubscribe
```

**Database Schema:**
```sql
CREATE TABLE topic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(255) NOT NULL UNIQUE,
  is_auto_detected BOOLEAN NOT NULL DEFAULT false,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  notification_frequency VARCHAR(50) NOT NULL DEFAULT 'daily',  -- 'daily', 'weekly', 'real-time'
  last_fetch TIMESTAMP,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON topic_subscriptions(enabled);
CREATE INDEX ON topic_subscriptions(last_fetch);
```

**UI Component:**
```typescript
@Component({
  selector: 'app-interests-manager',
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>My Interests</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <!-- Auto-detected interests -->
        <h3>🤖 Auto-detected</h3>
        <div *ngFor="let interest of autoDetected()">
          <mat-chip>
            {{ interest.topic }}
            <span class="confidence">{{ interest.confidence | percent }}</span>
          </mat-chip>
          <button mat-button (click)="confirm(interest)">Confirm</button>
          <button mat-button (click)="ignore(interest)">Ignore</button>
        </div>

        <!-- Confirmed subscriptions -->
        <h3>📝 Subscribed</h3>
        <mat-list>
          <mat-list-item *ngFor="let sub of subscriptions()">
            <span>{{ sub.topic }}</span>
            <span class="frequency">{{ sub.frequency }}</span>
            <button mat-icon-button (click)="edit(sub)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button (click)="remove(sub)">
              <mat-icon>delete</mat-icon>
            </button>
          </mat-list-item>
        </mat-list>

        <!-- Add custom topic -->
        <mat-form-field>
          <input matInput placeholder="Add custom topic..."
                 [(ngModel)]="newTopic">
          <button mat-button matSuffix (click)="addTopic()">Add</button>
        </mat-form-field>
      </mat-card-content>
    </mat-card>
  `
})
export class InterestsManagerComponent {
  autoDetected = signal<Interest[]>([]);
  subscriptions = signal<Subscription[]>([]);
  newTopic = signal('');

  confirm(interest: Interest) {
    this.interestsService.confirmInterest(interest.id)
      .subscribe(() => {
        this.autoDetected.update(list =>
          list.filter(i => i.id !== interest.id)
        );
        this.loadSubscriptions();
      });
  }
}
```

**4.3: Tavily News Aggregation**
```typescript
class NewsAggregationService {
  constructor(
    private tavilyClient: TavilyClient,
    private subscriptionsRepo: SubscriptionsRepository,
    private newsRepo: NewsRepository
  ) {}

  @Cron('0 6 * * *')  // 6 AM daily
  async aggregateDailyNews() {
    const subscriptions = await this.subscriptionsRepo.findActive();

    for (const sub of subscriptions) {
      try {
        // Query Tavily
        const results = await this.tavilyClient.search({
          query: `latest news about ${sub.topic}`,
          days: 1,  // Last 24 hours
          max_results: 5
        });

        // Filter by relevance
        const relevant = results.filter(r => r.score > 0.7);

        // Store news items
        for (const item of relevant) {
          await this.newsRepo.upsert({
            topic: sub.topic,
            title: item.title,
            summary: item.content,
            url: item.url,
            source: item.source,
            publishedAt: new Date(item.published_date),
            relevanceScore: item.score
          });
        }

        // Update last fetch
        await this.subscriptionsRepo.updateLastFetch(sub.id);

      } catch (error) {
        console.error(`Failed to fetch news for ${sub.topic}:`, error);
        // Continue with other topics
      }
    }

    // Generate digest after all topics fetched
    await this.digestService.generateDailyDigest();
  }
}
```

**Database Schema:**
```sql
CREATE TABLE news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  url VARCHAR(500) NOT NULL UNIQUE,
  source VARCHAR(255),
  published_at TIMESTAMP NOT NULL,
  relevance_score DECIMAL(3,2) NOT NULL,
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_news_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date DATE NOT NULL UNIQUE,
  news_items JSONB NOT NULL,  -- [{ topic, items[] }]
  generated_at TIMESTAMP DEFAULT NOW(),
  viewed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX ON news_items(topic, published_at);
CREATE INDEX ON news_items(fetched_at);
CREATE INDEX ON user_news_digest(digest_date);
```

**4.4: Digest Generation Service**
```typescript
class DigestGenerationService {
  async generateDailyDigest(): Promise<Digest> {
    const today = new Date().toISOString().split('T')[0];

    // 1. Get news by topic
    const subscriptions = await this.subscriptionsRepo.findActive();
    const newsByTopic = await Promise.all(
      subscriptions.map(async sub => ({
        topic: sub.topic,
        items: await this.newsRepo.findByTopicSince(sub.topic, new Date(Date.now() - 24 * 60 * 60 * 1000))
      }))
    );

    // 2. Get user insights (tasks, notes)
    const tasksDueToday = await this.tasksRepo.findDueToday();
    const recentNotes = await this.notesRepo.findCreatedYesterday();
    const relatedNotes = await this.findNotesRelatedToNews(newsByTopic);

    // 3. Use LLM to generate summary
    const summary = await this.llmService.generateDigestSummary({
      news: newsByTopic,
      tasks: tasksDueToday,
      recentNotes,
      relatedNotes
    });

    // 4. Store digest
    const digest = await this.digestRepo.create({
      digestDate: today,
      newsItems: newsByTopic,
      summary,
      tasks: tasksDueToday,
      insights: {
        recentNotes: recentNotes.length,
        relatedTopics: relatedNotes.length
      }
    });

    return digest;
  }

  private async findNotesRelatedToNews(newsByTopic: any[]): Promise<Note[]> {
    const allTopics = newsByTopic.map(n => n.topic);
    const related = [];

    for (const topic of allTopics) {
      // Semantic search in notes
      const notes = await this.searchService.searchNotes(topic, limit: 3);
      related.push(...notes);
    }

    return related;
  }
}
```

**Digest Display UI:**
```typescript
@Component({
  selector: 'app-daily-digest',
  template: `
    <mat-card class="digest-card">
      <mat-card-header>
        <mat-card-title>
          Good Morning! 🌅
          <span class="date">{{ digest().digestDate | date }}</span>
        </mat-card-title>
      </mat-card-header>

      <mat-card-content>
        <!-- News by topic -->
        <div *ngFor="let topicNews of digest().newsByTopic">
          <h3>{{ topicNews.topic }} ({{ topicNews.items.length }} articles)</h3>
          <mat-list>
            <mat-list-item *ngFor="let item of topicNews.items">
              <h4>{{ item.title }}</h4>
              <p>{{ item.summary }}</p>
              <a [href]="item.url" target="_blank">Read more</a>
              <span class="source">{{ item.source }}</span>
              <span class="score">{{ item.relevanceScore | percent }}</span>
            </mat-list-item>
          </mat-list>
        </div>

        <!-- Your notes insights -->
        <mat-divider></mat-divider>
        <h3>Your Notes</h3>
        <p>{{ digest().insights.recentNotes }} notes created yesterday</p>
        <p>{{ digest().insights.relatedTopics }} notes related to today's news</p>

        <!-- Tasks -->
        <mat-divider></mat-divider>
        <h3>Today's Tasks ({{ digest().tasks.length }})</h3>
        <mat-list>
          <mat-list-item *ngFor="let task of digest().tasks">
            {{ task.title }}
          </mat-list-item>
        </mat-list>

        <button mat-raised-button color="primary"
                [routerLink]="['/chat']">
          Ask questions about today's news
        </button>
      </mat-card-content>
    </mat-card>
  `
})
export class DailyDigestComponent {
  digest = signal<Digest | null>(null);

  ngOnInit() {
    this.digestService.getToday()
      .subscribe(digest => this.digest.set(digest));
  }
}
```

**4.5: Feedback & Learning**
```typescript
// Track user interactions with digest
@OnEvent('news.item.clicked')
async handleNewsClick(event: NewsClickedEvent) {
  // Boost confidence of this topic
  await this.interestsService.boostConfidence(event.topic, 0.05);

  // Log interaction
  await this.interactionsRepo.create({
    newsItemId: event.itemId,
    interactionType: 'click',
    timestamp: new Date()
  });
}

@OnEvent('news.item.disliked')
async handleNewsDislike(event: NewsDislikedEvent) {
  // Reduce confidence
  await this.interestsService.reduceConfidence(event.topic, 0.1);

  // If confidence drops below threshold, suggest unsubscribe
  const interest = await this.interestsService.get(event.topic);
  if (interest.confidence < 0.5) {
    await this.notificationService.suggest(
      `You seem less interested in ${event.topic}. Unsubscribe?`
    );
  }
}
```

**Database Schema:**
```sql
CREATE TABLE news_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_item_id UUID REFERENCES news_items(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL,  -- 'click', 'like', 'dislike', 'save'
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE digest_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id UUID REFERENCES user_news_digest(id) ON DELETE CASCADE,
  feedback VARCHAR(50) NOT NULL,  -- 'helpful', 'not_helpful', 'too_long', 'too_short'
  comment TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON news_interactions(news_item_id);
CREATE INDEX ON news_interactions(interaction_type);
```

**Events:**
```typescript
DailyDigestScheduledEvent (6 AM) → NewsAggregationService
NewsAggregationCompletedEvent → DigestGenerationService
DigestGeneratedEvent → NotificationService
NewsItemClickedEvent → InterestBoostService
NewsItemDislikedEvent → InterestReduceService
```

**Testing:**
- Unit: Interest extraction, Tavily integration, digest generation
- Integration: Subscription → News fetch → Digest
- E2E: Create notes on topic → Interest detected → News appears in digest

**Deliverable:** Morning digest ready at 6 AM with relevant news and insights

---

#### Expansion (Phase 4.5 - Week 14):

**4.6: Email Delivery** (Future)
- NodeMailer integration
- HTML email templates
- User preference: email vs in-app

**4.7: Real-time Notifications** (Future)
- WebSocket for breaking news
- Push notifications

**4.8: Digest Customization**
- Adjust summary length
- Filter news by source
- Custom digest time

---

### Phase 5: Document Intelligence (Weeks 15-17)

**Goal:** Import knowledge from PDFs and web pages

#### MVP Baseline (Week 15-16):

**5.1: Document Upload API**
```typescript
// File upload endpoint
@Post('/documents')
@UseInterceptors(FileInterceptor('file'))
async uploadDocument(@UploadedFile() file: Express.Multer.File) {
  // Store in database blob
  const doc = await this.documentsRepo.create({
    filename: file.originalname,
    contentType: file.mimetype,
    fileSize: file.size,
    fileData: file.buffer,
    processed: false
  });

  // Trigger async processing
  await this.eventsService.publish('document.uploaded', {
    documentId: doc.id,
    contentType: doc.contentType
  });

  return doc;
}
```

**Database Schema:**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  file_data BYTEA NOT NULL,  -- Blob storage
  file_size INTEGER NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  note_id UUID REFERENCES notes(id),  -- Created note
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON documents(processed);
CREATE INDEX ON documents(content_type);
```

**5.2: PDF Processing Service**
```typescript
class PDFProcessorService {
  @OnEvent('document.uploaded')
  async processDocument(event: DocumentUploadedEvent) {
    const doc = await this.documentsRepo.findById(event.documentId);

    if (doc.contentType === 'application/pdf') {
      await this.processPDF(doc);
    } else if (doc.contentType.startsWith('image/')) {
      await this.processImage(doc);  // Future: OCR
    }
  }

  private async processPDF(doc: Document): Promise<void> {
    try {
      // Extract text from PDF
      const text = await this.extractPDFText(doc.fileData);

      // Extract metadata
      const metadata = await this.extractPDFMetadata(doc.fileData);

      // Create note from extracted text
      const note = await this.notesService.create({
        title: doc.filename.replace('.pdf', ''),
        content: text,
        metadata: {
          source: 'document',
          documentId: doc.id,
          author: metadata.author,
          createdDate: metadata.createdDate
        }
      });

      // Update document
      await this.documentsRepo.update(doc.id, {
        processed: true,
        noteId: note.id,
        metadata: metadata
      });

      // Emit event for embedding generation
      await this.eventsService.publish('note.created', {
        noteId: note.id,
        content: text
      });

    } catch (error) {
      console.error('PDF processing failed:', error);
      await this.documentsRepo.update(doc.id, {
        processed: false,
        metadata: { error: error.message }
      });
    }
  }

  private async extractPDFText(buffer: Buffer): Promise<string> {
    // Use pdf-parse or similar library
    const data = await pdfParse(buffer);
    return data.text;
  }
}
```

**5.3: URL Content Extraction**
```typescript
// API endpoint
POST /api/documents/url
Body: { url: "https://example.com/article" }

class WebScraperService {
  async scrapeURL(url: string): Promise<Note> {
    // Fetch HTML
    const response = await fetch(url);
    const html = await response.text();

    // Parse and clean
    const $ = cheerio.load(html);

    // Extract main content (heuristic)
    const title = $('h1').first().text() || $('title').text();
    const content = $('article').text() || $('main').text() || $('body').text();

    // Convert to markdown
    const markdown = this.htmlToMarkdown(content);

    // Create note
    const note = await this.notesService.create({
      title: title,
      content: markdown,
      metadata: {
        source: 'url',
        url: url,
        fetchedAt: new Date()
      }
    });

    return note;
  }
}
```

**5.4: Document Management UI**
```typescript
@Component({
  selector: 'app-documents',
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Documents</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        <!-- Upload -->
        <input type="file" #fileInput
               (change)="onFileSelected($event)"
               accept=".pdf"
               style="display: none">
        <button mat-raised-button (click)="fileInput.click()">
          <mat-icon>upload</mat-icon>
          Upload PDF
        </button>

        <!-- URL import -->
        <mat-form-field>
          <input matInput placeholder="Enter URL..." [(ngModel)]="url">
          <button mat-button matSuffix (click)="importURL()">Import</button>
        </mat-form-field>

        <!-- Document list -->
        <mat-list>
          <mat-list-item *ngFor="let doc of documents()">
            <mat-icon>{{ getIcon(doc.contentType) }}</mat-icon>
            <span>{{ doc.filename }}</span>
            <span class="size">{{ doc.fileSize | filesize }}</span>
            <span *ngIf="doc.processed" class="status success">✓ Processed</span>
            <span *ngIf="!doc.processed" class="status pending">⏳ Processing...</span>
            <button mat-icon-button [routerLink]="['/notes', doc.noteId]"
                    *ngIf="doc.noteId">
              <mat-icon>note</mat-icon>
            </button>
            <button mat-icon-button (click)="download(doc)">
              <mat-icon>download</mat-icon>
            </button>
            <button mat-icon-button (click)="delete(doc)">
              <mat-icon>delete</mat-icon>
            </button>
          </mat-list-item>
        </mat-list>
      </mat-card-content>
    </mat-card>
  `
})
export class DocumentsComponent {
  documents = signal<Document[]>([]);
  url = signal('');

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.documentsService.upload(file)
        .subscribe(() => this.loadDocuments());
    }
  }

  importURL() {
    this.documentsService.importURL(this.url())
      .subscribe(() => {
        this.url.set('');
        this.loadDocuments();
      });
  }
}
```

**Events:**
```typescript
DocumentUploadedEvent → PDFProcessorService → NoteCreatedEvent
URLSubmittedEvent → WebScraperService → NoteCreatedEvent
NoteCreatedEvent → EmbeddingGenerationService (existing)
```

**Testing:**
- Unit: PDF text extraction, HTML parsing
- Integration: Upload → Process → Note creation
- E2E: Upload PDF → Search finds content

**Deliverable:** Upload PDFs and import web pages as searchable notes

---

#### Expansion (Phase 5.5 - Week 17):

**5.6: Smart Chunking**
```typescript
// Split large documents into logical sections
class DocumentChunker {
  chunk(text: string, metadata: any): Chunk[] {
    // Detect sections (by headers, page breaks, etc.)
    const sections = this.detectSections(text);

    return sections.map((section, index) => ({
      title: `${metadata.title} - Section ${index + 1}`,
      content: section.text,
      order: index,
      metadata: {
        ...metadata,
        section: section.heading,
        pageRange: section.pages
      }
    }));
  }
}
```

**5.7: OCR for Scanned PDFs**
```typescript
// Use Tesseract.js for OCR
import Tesseract from 'tesseract.js';

class OCRService {
  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    const result = await Tesseract.recognize(imageBuffer, 'eng');
    return result.data.text;
  }
}
```

**5.8: Metadata Extraction**
```typescript
// Extract author, date, keywords from documents
class MetadataExtractor {
  async extract(doc: Document): Promise<Metadata> {
    if (doc.contentType === 'application/pdf') {
      return this.extractPDFMetadata(doc.fileData);
    }
    // ... other types
  }

  private async extractPDFMetadata(buffer: Buffer): Promise<Metadata> {
    const data = await pdfParse(buffer);
    return {
      title: data.info.Title,
      author: data.info.Author,
      createdDate: data.info.CreationDate,
      pageCount: data.numpages,
      keywords: data.info.Keywords?.split(',') || []
    };
  }
}
```

---

## Implementation Guidelines

### Development Workflow

**For Each Phase:**

1. **Design Review**
   - Review database schemas
   - Validate API contracts
   - Confirm event flows

2. **Backend First**
   - Implement NestJS services
   - Write unit tests (TDD)
   - Create integration tests
   - Test events with Redis

3. **Python Services** (if applicable)
   - Implement FastAPI service
   - Write unit tests
   - Test integration with NestJS

4. **Frontend Implementation**
   - Create Angular components
   - Write component tests
   - Integrate with backend APIs

5. **E2E Testing**
   - Test full user workflows
   - Verify event chains
   - Validate UI/UX

6. **Documentation**
   - Update API docs (Swagger)
   - Document events
   - Write usage guides

7. **Code Review & Refinement**
   - Review with code-reviewer agent
   - Address issues
   - Optimize as needed

8. **Deployment**
   - Update docker-compose
   - Deploy to server
   - Monitor for issues

### Testing Strategy

**Unit Tests:**
- Service logic
- Pure functions
- Validators
- Transformers

**Integration Tests:**
- API endpoints
- Database operations
- Event publishing/subscribing
- Service-to-service communication

**E2E Tests:**
- Complete user workflows
- UI interactions
- Data persistence
- Real-time features

**AI Feature Testing:**
- Golden dataset for RAG accuracy
- Embedding similarity thresholds
- Mock LLM for deterministic tests
- Manual validation for quality

### Error Handling Standards

**External Services:**
- Always use try-catch with logging
- Implement retry with exponential backoff (3 attempts)
- Graceful degradation (cached data, warnings)
- User-friendly error messages

**Event Processing:**
- Dead letter queue for failed events
- Manual retry mechanism
- Alert on persistent failures

**Data Validation:**
- class-validator at DTO layer
- Database constraints
- Business logic validation in services

---

## Service Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Angular 20)                     │
│  Components: Notes, Chat, Graph, Interests, Documents           │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Layer (NestJS)                         │
├─────────────────────────────────────────────────────────────────┤
│  Notes Service    │  Chat Service  │  News Service              │
│  Tasks Service    │  Relationships │  Documents Service         │
└─────────────────────────────────────────────────────────────────┘
            │                           │                   │
            │ HTTP                      │ Redis Pub/Sub     │
            ▼                           ▼                   ▼
┌──────────────────┐      ┌─────────────────────────────────────┐
│  Embeddings      │      │        Event Bus (Redis)            │
│  Service         │      │  - note.created                     │
│  (Python/FastAPI)│      │  - note.updated                     │
│                  │      │  - document.uploaded                │
│  - Generate      │      │  - chat.message.sent                │
│  - Search        │      │  - interest.detected                │
└──────────────────┘      └─────────────────────────────────────┘
            │                           │
            │                           │
            ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Persistence Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL 17 + pgvector                                        │
│  - Notes, Tasks, Embeddings                                      │
│  - Relationships, Chat Sessions                                  │
│  - Interests, Subscriptions, News                                │
│  - Documents (BYTEA blobs)                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  Ollama (DeepSeek-R1)  │  Tavily API  │  Bull Queue (Redis)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Overview

### Existing Tables
```sql
notes (id, title, content, created_at, updated_at)
tasks (id, note_id, title, description, status, priority, due_date, ...)
```

### Phase 1: RAG Foundation
```sql
note_embeddings (id, note_id, embedding vector(384), model, created_at)
```

### Phase 2: Conversational AI
```sql
chat_sessions (id, title, created_at, updated_at)
chat_messages (id, session_id, role, content, sources, created_at)
```

### Phase 3: Knowledge Graph
```sql
note_relationships (id, source_note_id, target_note_id, type, confidence, metadata, created_at)
```

### Phase 4: Intelligent News
```sql
user_interests (id, topic, confidence, source_type, evidence_count, last_seen, created_at)
interest_evidence (id, interest_id, source_id, source_type, relevance_score, created_at)
topic_subscriptions (id, topic, is_auto_detected, confirmed, frequency, enabled, created_at)
news_items (id, topic, title, summary, url, source, published_at, relevance_score, fetched_at)
user_news_digest (id, digest_date, news_items, generated_at, viewed)
news_interactions (id, news_item_id, interaction_type, timestamp)
digest_feedback (id, digest_id, feedback, comment, timestamp)
```

### Phase 5: Document Intelligence
```sql
documents (id, filename, content_type, file_data, file_size, processed, note_id, metadata, created_at)
```

---

## Event Catalog

### Existing Events
- `NoteCreatedEvent` - Note created
- `NoteUpdatedEvent` - Note updated
- `NoteDeletedEvent` - Note deleted
- `TaskExtractedEvent` - Task extracted by LLM

### Phase 1 Events
- `EmbeddingGeneratedEvent` - Embedding created
- `EmbeddingUpdatedEvent` - Embedding refreshed

### Phase 2 Events
- `ChatSessionCreatedEvent` - New chat session
- `ChatMessageSentEvent` - User sent message
- `ChatResponseGeneratedEvent` - Assistant replied

### Phase 3 Events
- `RelationshipDetectedEvent` - New relationship found
- `WikiLinkParsedEvent` - [[link]] found in note
- `RelationshipCreatedEvent` - Relationship stored

### Phase 4 Events
- `InterestDetectedEvent` - New interest discovered
- `InterestConfirmedEvent` - User confirmed interest
- `TopicSubscribedEvent` - User subscribed to topic
- `NewsAggregationScheduledEvent` - Cron triggered (6 AM)
- `NewsItemFetchedEvent` - News item retrieved
- `DigestGeneratedEvent` - Daily digest ready
- `DigestViewedEvent` - User opened digest
- `NewsItemClickedEvent` - User clicked news
- `NewsItemDislikedEvent` - User disliked news

### Phase 5 Events
- `DocumentUploadedEvent` - Document uploaded
- `PDFProcessedEvent` - PDF text extracted
- `URLScrapedEvent` - Web page scraped

---

## Technology Dependencies

### Backend (NestJS)
```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/typeorm": "^11.0.0",
    "@nestjs/bull": "^10.0.0",
    "bull": "^4.12.0",
    "ioredis": "^5.3.0",
    "pg": "^8.11.0",
    "pgvector": "^0.1.0",
    "pdf-parse": "^1.1.1",
    "cheerio": "^1.0.0",
    "axios": "^1.6.0"
  }
}
```

### Python Embeddings Service
```python
# requirements.txt
fastapi==0.109.0
uvicorn==0.27.0
sentence-transformers==2.3.0
torch==2.2.0  # GPU support
pydantic==2.5.0
```

### Frontend (Angular)
```json
{
  "dependencies": {
    "@angular/core": "^20.0.0",
    "@angular/material": "^20.0.0",
    "d3": "^7.8.0",  # For graph visualization (Phase 3.5)
    "cytoscape": "^3.28.0"  # Alternative graph library
  }
}
```

---

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: notes_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  notes-service:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/notes_db
      REDIS_URL: redis://redis:6379
      EMBEDDINGS_SERVICE_URL: http://embeddings-service:8001
      OLLAMA_URL: http://host.docker.internal:11434
      TAVILY_API_KEY: ${TAVILY_API_KEY}
    depends_on:
      - postgres
      - redis
    ports:
      - "3005:3005"

  embeddings-service:
    build: ./embeddings-service
    environment:
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis
    ports:
      - "8001:8001"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  frontend:
    build: ./frontend
    ports:
      - "4200:80"
    depends_on:
      - notes-service

volumes:
  postgres_data:
  redis_data:
```

---

## Deployment Checklist

### Pre-Production
- [ ] Authentication system implemented (JWT)
- [ ] HTTPS/SSL certificates configured
- [ ] Environment variables secured
- [ ] Database backups automated
- [ ] Monitoring and logging setup
- [ ] Error tracking (Sentry or similar)
- [ ] Security audit passed

### Production Deployment
- [ ] Docker images built and tagged
- [ ] Database migrations run
- [ ] Services deployed via docker-compose
- [ ] Health checks passing
- [ ] SSL certificates valid
- [ ] Firewall rules configured
- [ ] Monitoring dashboards configured
- [ ] Backup restoration tested

---

## Next Steps

1. **Review and Approve Plan** - Confirm all decisions and architecture
2. **Setup Python Embeddings Service** - Create FastAPI microservice
3. **Implement Phase 1 MVP** - Start with embedding generation
4. **Iterate Through Phases** - Build incrementally with testing

**Ready to begin implementation!** 🚀
