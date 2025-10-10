# Data Model

**Feature**: Notes CRUD, Conversations, and Categorization
**Date**: 2025-10-05
**Based on**: research.md decisions

## Entity Relationship Diagram

```
┌─────────────────┐
│      User       │
│ (existing)      │
└────────┬────────┘
         │
         │ 1:N
         ├──────────────────────────────────┐
         │                                  │
         │                                  │
    ┌────▼────────┐              ┌─────────▼────────┐
    │  Conversation│              │   Category       │
    │              │              │                  │
    │  id (PK)     │              │  id (PK)         │
    │  title       │              │  name            │
    │  description │              │  type (enum)     │
    │  userId (FK) │◄────┐        │  userId (FK)     │
    │  createdAt   │     │        │  createdAt       │
    │  updatedAt   │     │        │  updatedAt       │
    └──────┬───────┘     │        └────────┬─────────┘
           │             │                 │
           │ 1:N         │                 │ N:M
           │             │                 │
           │     ┌───────┴────────┐        │
           │     │     Note       │        │
           │     │  (existing)    │        │
           │     │                │        │
           └────►│  id (PK)       │◄───────┘
                 │  title         │
                 │  content       │
                 │  userId (FK)   │
                 │  conversationId│  (NEW - nullable FK)
                 │  createdAt     │
                 │  updatedAt     │  (NEW field)
                 └────────────────┘
                         │
                         │ N:M
                         │
                 ┌───────▼────────────┐
                 │  note_categories   │
                 │  (junction table)  │
                 │                    │
                 │  noteId (FK)       │
                 │  categoryId (FK)   │
                 └────────────────────┘

                 ┌──────────────────────────┐
                 │ conversation_categories  │
                 │ (junction table)         │
                 │                          │
                 │ conversationId (FK)      │
                 │ categoryId (FK)          │
                 └──────────────────────────┘
```

## Entity Specifications

### 1. Conversation (NEW)

**Purpose**: Groups related notes into threaded discussions or collections

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `title` | VARCHAR(200) | NOT NULL | Conversation title |
| `description` | TEXT | NULL | Optional detailed description |
| `userId` | UUID | FOREIGN KEY (users.id), NOT NULL | Owner of conversation |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last modification timestamp |

**Relationships**:
- **User**: N:1 (many conversations per user)
  - FK: `userId` → `users.id`
  - Cascade: `ON DELETE CASCADE` (delete conversations when user deleted)
- **Note**: 1:N (one conversation contains many notes)
  - Inverse FK: `notes.conversationId` → `conversations.id`
  - Cascade: `ON DELETE SET NULL` (notes become standalone when conversation deleted)
- **Category**: N:M (many categories per conversation, many conversations per category)
  - Junction: `conversation_categories`
  - Cascade: `ON DELETE CASCADE` (junction entries only)

**Indexes**:
- Primary: `id`
- Foreign key: `userId`
- Query optimization: `(userId, createdAt DESC)` for listing user's conversations

**Validation Rules**:
- `title`: required, 1-200 characters
- `description`: optional, max 2000 characters
- `userId`: must reference existing user
- User can create unlimited conversations

**State Transitions**:
- Created → Active (default state)
- Active → Updated (when title/description modified)
- Active → Deleted (permanent deletion, notes become standalone)

---

### 2. Category (NEW)

**Purpose**: Classifies notes and conversations with system-provided or user-created tags

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `name` | VARCHAR(100) | NOT NULL | Category name/label |
| `type` | ENUM | NOT NULL, ('system', 'user') | Category ownership type |
| `userId` | UUID | FOREIGN KEY (users.id), NULL | Owner (NULL for system categories) |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last modification timestamp |

**Relationships**:
- **User**: N:1 (many categories per user; NULL for system categories)
  - FK: `userId` → `users.id`
  - Cascade: `ON DELETE CASCADE` (delete user categories when user deleted)
- **Note**: N:M (many notes per category, many categories per note)
  - Junction: `note_categories`
  - Cascade: `ON DELETE CASCADE` (junction entries only)
- **Conversation**: N:M (many conversations per category, many categories per conversation)
  - Junction: `conversation_categories`
  - Cascade: `ON DELETE CASCADE` (junction entries only)

**Indexes**:
- Primary: `id`
- Unique composite: `(name, userId, type)` - prevents duplicate category names per scope
- Foreign key: `userId`
- Query optimization: `type` for filtering system vs user categories

**Validation Rules**:
- `name`: required, 1-100 characters, alphanumeric + spaces/hyphens
- `type`: must be 'system' or 'user'
- `userId`: NULL for system categories, required for user categories
- System categories: cannot be modified or deleted
- User categories: can only be modified/deleted by owner

**State Transitions**:
- System categories: Created (via seed migration) → Immutable
- User categories: Created → Active → Updated (name changes) → Deleted

**System Categories** (seeded on migration):
- Work
- Personal
- Ideas
- Tasks
- Reference

---

### 3. Note (UPDATED - existing entity)

**Purpose**: Individual content items with title and body

**New/Modified Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `conversationId` | UUID | FOREIGN KEY (conversations.id), NULL | **NEW** - Optional conversation membership |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | **NEW** - Last modification timestamp |

**Existing Fields** (unchanged):
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique identifier |
| `title` | VARCHAR(200) | NOT NULL | Note title |
| `content` | TEXT | NOT NULL | Note body/content |
| `userId` | UUID | FOREIGN KEY (users.id), NOT NULL | Owner of note |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation timestamp |

**New Relationships**:
- **Conversation**: N:1 (many notes per conversation; NULL for standalone notes)
  - FK: `conversationId` → `conversations.id`
  - Cascade: `ON DELETE SET NULL` (note becomes standalone when conversation deleted)
- **Category**: N:M (many categories per note, many notes per category)
  - Junction: `note_categories`
  - Cascade: `ON DELETE CASCADE` (junction entries only)

**Existing Relationships** (unchanged):
- **User**: N:1 (many notes per user)
  - FK: `userId` → `users.id`
  - Cascade: `ON DELETE CASCADE`

**Indexes**:
- Primary: `id`
- Foreign keys: `userId`, `conversationId` (new)
- Query optimization: `(userId, createdAt DESC)` for listing user's notes
- Query optimization: `(conversationId, createdAt ASC)` for conversation notes

**Validation Rules** (new/updated):
- All existing validation rules preserved
- `conversationId`: optional, must reference existing conversation if provided
- Adding note to conversation when already in one → moves note (replaces conversationId)
- Removing note from conversation → sets conversationId to NULL

---

### 4. note_categories (NEW Junction Table)

**Purpose**: Links notes to categories (many-to-many)

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `noteId` | UUID | FOREIGN KEY (notes.id), NOT NULL | Reference to note |
| `categoryId` | UUID | FOREIGN KEY (categories.id), NOT NULL | Reference to category |

**Constraints**:
- Composite primary key: `(noteId, categoryId)`
- Cascade: `ON DELETE CASCADE` for both FKs (remove junction entry when either note or category deleted)

**Indexes**:
- Composite PK: `(noteId, categoryId)`
- Query optimization: `categoryId` for filtering notes by category

---

### 5. conversation_categories (NEW Junction Table)

**Purpose**: Links conversations to categories (many-to-many)

**Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `conversationId` | UUID | FOREIGN KEY (conversations.id), NOT NULL | Reference to conversation |
| `categoryId` | UUID | FOREIGN KEY (categories.id), NOT NULL | Reference to category |

**Constraints**:
- Composite primary key: `(conversationId, categoryId)`
- Cascade: `ON DELETE CASCADE` for both FKs (remove junction entry when either conversation or category deleted)

**Indexes**:
- Composite PK: `(conversationId, categoryId)`
- Query optimization: `categoryId` for filtering conversations by category

---

## Cascade Deletion Summary

| Deletion Trigger | Effect | Rationale |
|------------------|--------|-----------|
| Delete User | Cascades to all user's notes, conversations, categories | Data ownership |
| Delete Conversation | Notes' `conversationId` → NULL (standalone) | Preserve note data |
| Delete Note | Removes from conversation, removes category associations | Clean deletion |
| Delete System Category | ERROR - cannot delete | System categories are immutable |
| Delete User Category | Removes note/conversation associations, preserves entities | Data safety |

## Migration Strategy

**Migration Order**:
1. Add `updatedAt` column to `notes` table (nullable initially, backfill with createdAt, then set NOT NULL)
2. Create `conversations` table
3. Add `conversationId` column to `notes` table (nullable FK)
4. Create `categories` table
5. Create `note_categories` junction table
6. Create `conversation_categories` junction table
7. Seed system categories
8. Create indexes

**Rollback Strategy**:
- Drop tables in reverse order
- Remove columns from notes in reverse order
- Preserve existing note data

**Data Migration**:
- No existing data migration needed (all fields nullable or have defaults)
- Existing notes remain standalone (conversationId = NULL)
- No categories assigned initially

---

## Query Patterns

**Common Queries**:

```sql
-- Get user's conversations with note count
SELECT c.*, COUNT(n.id) as noteCount
FROM conversations c
LEFT JOIN notes n ON n.conversationId = c.id
WHERE c.userId = :userId
GROUP BY c.id
ORDER BY c.updatedAt DESC;

-- Get notes in conversation (chronological)
SELECT n.* FROM notes n
WHERE n.conversationId = :conversationId
ORDER BY n.createdAt ASC;

-- Get all available categories for user (system + user's custom)
SELECT * FROM categories
WHERE type = 'system' OR userId = :userId
ORDER BY type, name;

-- Get notes by category
SELECT n.* FROM notes n
INNER JOIN note_categories nc ON n.id = nc.noteId
WHERE nc.categoryId = :categoryId AND n.userId = :userId
ORDER BY n.createdAt DESC;

-- Get note with all categories
SELECT n.*, array_agg(c.id) as categoryIds, array_agg(c.name) as categoryNames
FROM notes n
LEFT JOIN note_categories nc ON n.id = nc.noteId
LEFT JOIN categories c ON nc.categoryId = c.id
WHERE n.id = :noteId
GROUP BY n.id;
```

## TypeORM Entity Implementations

See `contracts/entities/` for complete entity class definitions with decorators.

---

## Data Integrity Rules

1. **Referential Integrity**: All foreign keys enforced at database level
2. **Cascade Consistency**: Deletion cascades preserve entity data by default
3. **Unique Constraints**: Category names unique per user scope
4. **Nullable Foreign Keys**: conversationId allows standalone notes
5. **Enum Validation**: Category type restricted to 'system' | 'user'
6. **Immutability**: System categories cannot be modified or deleted
7. **User Data Isolation**: Users can only access their own data (enforced in API layer)

---

**Status**: ✅ Complete - Ready for contract generation and quickstart scenarios
