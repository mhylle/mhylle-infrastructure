
# Implementation Plan: Notes CRUD, Conversations, and Categorization

**Branch**: `001-right-now-you` | **Date**: 2025-10-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-right-now-you/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code, or `AGENTS.md` for all other agents).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Expand the existing mynotes application to add full CRUD operations (edit/delete notes), organize notes into conversations, and categorize both notes and conversations using a hybrid tagging system. The feature builds on the current Angular 19 + NestJS 11 + PostgreSQL stack with TypeORM, adding three new database entities (Conversation, Category, Note-Category associations) and implementing comprehensive REST API endpoints with proper validation, authentication integration, and referential integrity.

## Technical Context
**Language/Version**: TypeScript 5.7 (Backend: Node.js, Frontend: Angular 19)
**Primary Dependencies**: Backend: NestJS 11, TypeORM 0.3, PostgreSQL 17; Frontend: Angular 19 standalone components, RxJS 7.8
**Storage**: PostgreSQL 17 with pgvector extension (existing database: mynotes)
**Testing**: Backend: Jest + Supertest (E2E); Frontend: Karma + Jasmine
**Target Platform**: Web application (Docker containers + local development support)
**Project Type**: web (frontend + backend)
**Performance Goals**: <200ms API response time, <2s page load, smooth UI interactions
**Constraints**: Maintain backward compatibility with existing Note entity; preserve authentication dual-mode (local/production); support guest usage
**Scale/Scope**: Small-to-medium user base, <10k notes per user, <100 categories per user

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: Constitution file is a template without project-specific principles. Proceeding with industry best practices:
- ✅ Single Responsibility: Each entity (Note, Conversation, Category) has clear, focused purpose
- ✅ RESTful API Design: Standard HTTP verbs and resource naming
- ✅ Data Integrity: Foreign keys, cascade rules, proper relationships
- ✅ Test Coverage: Unit + E2E tests for all new endpoints
- ✅ Backward Compatibility: Existing Note entity extended, not replaced
- ✅ Security: Authentication preserved, input validation via DTOs

## Project Structure

### Documentation (this feature)
```
specs/001-right-now-you/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root: mynotes/)
```
backend/
├── src/
│   ├── notes/              # Existing notes module (extends for edit/delete)
│   ├── conversations/      # New module for conversation management
│   ├── categories/         # New module for category management
│   ├── common/             # Shared DTOs, interfaces, utilities
│   └── database/           # TypeORM entities and migrations
└── test/
    ├── e2e/                # End-to-end API tests
    └── unit/               # Unit tests for services

frontend/
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   ├── notes/          # Existing notes components (extend for edit/delete)
│   │   │   ├── conversations/  # New conversation management components
│   │   │   └── categories/     # New category management components
│   │   ├── shared/
│   │   │   ├── models/         # TypeScript interfaces for entities
│   │   │   └── services/       # HTTP services for API communication
│   │   └── core/               # Existing auth, navigation, etc.
└── test/                   # Component unit tests
```

**Structure Decision**: Web application (Option 2) with separate backend/ and frontend/ directories. This structure aligns with the existing mynotes project architecture and supports independent development, testing, and deployment of frontend and backend services.

## Phase 0: Outline & Research

**Purpose**: Resolve remaining unknowns from feature specification and establish technical patterns.

### Research Tasks

1. **TypeORM Many-to-Many Relationships**
   - **Unknown**: Best practices for Note-Category and Conversation-Category junction tables
   - **Research**: TypeORM `@ManyToMany` decorator patterns, junction table customization, cascade options
   - **Output**: Recommended entity relationship structure with proper cascade rules

2. **NestJS DTO Validation Patterns**
   - **Unknown**: Validation strategies for optional fields (conversation description, category assignment)
   - **Research**: class-validator decorators for conditional validation, array validation, nested objects
   - **Output**: DTO validation patterns for create/update operations

3. **Angular Standalone Component Communication**
   - **Unknown**: Best practices for component communication in Angular 19 standalone architecture
   - **Research**: Service-based state management, RxJS patterns for data sharing, component input/output
   - **Output**: Recommended patterns for note-conversation-category interactions

4. **PostgreSQL Cascade Deletion Strategies**
   - **Unknown**: Optimal cascade behavior for note deletion (remove from conversation) vs conversation deletion
   - **Research**: TypeORM cascade options (`CASCADE`, `SET NULL`, `RESTRICT`), soft delete alternatives
   - **Output**: Decision matrix for delete operations across entities

5. **System vs User Categories Implementation**
   - **Unknown**: Database schema for distinguishing system-provided vs user-created categories
   - **Research**: Enum-based vs flag-based approaches, seeding strategies, migration patterns
   - **Output**: Recommended schema design with seed data approach

### Deferred Clarifications (Low Impact)
- Note ordering in conversations → Default: chronological by createdAt (can be enhanced later)
- Delete confirmation dialogs → Default: yes (UX best practice)
- Soft-delete vs permanent deletion → Default: permanent delete (simpler, matches spec)
- Edit history tracking → Deferred to future iteration (track updatedAt only for now)
- Conversation deletion → Cascade to notes: make them standalone (consistent with note-conversation removal)
- Category deletion behavior → Unlink from items (preserve notes/conversations)

**Output**: `research.md` with decisions and rationale for all unknowns

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

### 1. Data Model (`data-model.md`)

**New Entities**:

**Conversation**
- `id`: UUID primary key
- `title`: string (required, max 200 chars)
- `description`: text (optional)
- `userId`: UUID foreign key to User
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `notes`: one-to-many relationship to Note

**Category**
- `id`: UUID primary key
- `name`: string (required, unique per user+type, max 100 chars)
- `type`: enum ('system', 'user')
- `userId`: UUID foreign key to User (null for system categories)
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `notes`: many-to-many relationship to Note
- `conversations`: many-to-many relationship to Conversation

**Updated Entity**:

**Note** (existing, add fields)
- `conversationId`: UUID foreign key to Conversation (nullable)
- `updatedAt`: timestamp (new field)
- `categories`: many-to-many relationship to Category (new)

**Junction Tables** (auto-generated by TypeORM):
- `note_categories`: (noteId, categoryId)
- `conversation_categories`: (conversationId, categoryId)

### 2. API Contracts (`contracts/`)

**Notes API** (extend existing):
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `PATCH /api/notes/:id/conversation` - Add/remove note from conversation
- `GET /api/notes/:id/categories` - Get note categories
- `PUT /api/notes/:id/categories` - Update note categories

**Conversations API** (new):
- `POST /api/conversations` - Create conversation
- `GET /api/conversations` - List user's conversations
- `GET /api/conversations/:id` - Get conversation with notes
- `PUT /api/conversations/:id` - Update conversation metadata
- `DELETE /api/conversations/:id` - Delete conversation
- `POST /api/conversations/:id/notes` - Create note in conversation
- `GET /api/conversations/:id/categories` - Get conversation categories
- `PUT /api/conversations/:id/categories` - Update conversation categories

**Categories API** (new):
- `GET /api/categories` - List all available categories (system + user's custom)
- `POST /api/categories` - Create custom category
- `PUT /api/categories/:id` - Update custom category name
- `DELETE /api/categories/:id` - Delete custom category
- `GET /api/categories/:id/notes` - Get notes with category
- `GET /api/categories/:id/conversations` - Get conversations with category

**DTOs** (create in contracts/dtos/):
- CreateConversationDto, UpdateConversationDto
- CreateCategoryDto, UpdateCategoryDto
- UpdateNoteDto (extend existing CreateNoteDto)
- AssignCategoriesDto

### 3. Contract Tests

Generate failing E2E tests for each endpoint:
- `test/e2e/notes.e2e-spec.ts` - Extend with edit/delete/categorization tests
- `test/e2e/conversations.e2e-spec.ts` - Full CRUD + note management tests
- `test/e2e/categories.e2e-spec.ts` - Full CRUD + filtering tests

### 4. Integration Test Scenarios (`quickstart.md`)

**Scenario 1: Complete Note Lifecycle**
1. Create standalone note
2. Edit note content
3. Assign categories to note
4. Add note to conversation
5. Remove note from conversation
6. Delete note

**Scenario 2: Conversation Management**
1. Create conversation with metadata
2. Create note directly in conversation
3. Add existing note to conversation
4. View conversation with all notes
5. Edit conversation metadata
6. Delete conversation (notes become standalone)

**Scenario 3: Category System**
1. List system categories
2. Create custom category
3. Assign multiple categories to note
4. Assign categories to conversation
5. Filter notes by category
6. Edit custom category name
7. Delete custom category (items retain other categories)

### 5. Agent File Update

Run: `.specify/scripts/bash/update-agent-context.sh claude`

Update `CLAUDE.md` with:
- New modules: conversations, categories
- Database entities: Conversation, Category, junction tables
- API endpoints summary
- Development workflow for new features

**Output**: data-model.md, contracts/*, failing E2E tests, quickstart.md, updated CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

The /tasks command will load `.specify/templates/tasks-template.md` and generate ordered, dependency-aware tasks following TDD principles:

**Phase-Based Grouping**:

**Phase 1: Database & Models** (Backend)
- Create TypeORM migration for new entities
- Implement Conversation entity
- Implement Category entity
- Update Note entity with new fields
- Seed system categories

**Phase 2: Backend - Categories Module**
- Create CategoryModule, Controller, Service
- Implement category CRUD endpoints
- Write category E2E tests
- Implement category filtering logic

**Phase 3: Backend - Conversations Module**
- Create ConversationModule, Controller, Service
- Implement conversation CRUD endpoints
- Write conversation E2E tests
- Implement note-conversation association logic

**Phase 4: Backend - Notes Extension**
- Extend NotesService with edit/delete
- Implement note-category associations
- Update Notes E2E tests
- Add cascade deletion handling

**Phase 5: Frontend - Shared Services**
- Create ConversationService
- Create CategoryService
- Update NoteService with edit/delete
- Create shared models/interfaces

**Phase 6: Frontend - Category UI**
- Create category list component
- Create category selector component
- Create category management dialog
- Wire up category filtering

**Phase 7: Frontend - Conversation UI**
- Create conversation list component
- Create conversation detail component
- Create conversation form component
- Integrate note-conversation management

**Phase 8: Frontend - Notes Enhancement**
- Add edit note functionality
- Add delete note confirmation
- Integrate category tagging in note forms
- Add conversation assignment UI

**Phase 9: Integration & Testing**
- Run full E2E test suite
- Execute quickstart.md scenarios
- Performance testing
- Bug fixes and refinements

**Ordering Strategy**:
- Database/models first (foundation)
- Backend API before frontend (contract-driven)
- Tests before implementation (TDD)
- Core features before UI enhancements
- Mark [P] for parallel tasks within same phase

**Estimated Output**: 45-55 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No constitutional violations identified. The design follows:
- Standard NestJS module patterns
- TypeORM best practices
- RESTful API conventions
- Angular standalone component architecture
- Existing project patterns and conventions

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - `research.md` created
- [x] Phase 1: Design complete (/plan command) - `data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md` updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - Strategy documented above
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (no project constitution; industry best practices applied)
- [x] Post-Design Constitution Check: PASS (no violations introduced)
- [x] All NEEDS CLARIFICATION resolved (5 critical clarifications addressed; 5 low-impact deferred with defaults)
- [x] Complexity deviations documented (none)

**Artifacts Generated**:
- ✅ `plan.md` - This file
- ✅ `research.md` - Technical research and decisions
- ✅ `data-model.md` - Entity specifications and relationships
- ✅ `contracts/api-specification.md` - REST API contracts and DTOs
- ✅ `quickstart.md` - Integration test scenarios
- ✅ `CLAUDE.md` - Updated with new modules and endpoints

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
