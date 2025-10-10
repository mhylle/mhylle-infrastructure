# Tasks: Notes CRUD, Conversations, and Categorization

**Feature**: 001-right-now-you
**Input**: Design documents from `/specs/001-right-now-you/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅
**Estimated Tasks**: 52 tasks across 9 phases
**Tech Stack**: TypeScript 5.7, NestJS 11, Angular 19, PostgreSQL 17, TypeORM 0.3

## Execution Flow

This tasks file follows TDD (Test-Driven Development) approach with the following structure:
1. **Setup**: Database migrations and entity creation (foundation)
2. **Backend Tests**: E2E tests for all API endpoints (MUST FAIL before implementation)
3. **Backend Implementation**: Services, controllers, DTOs (make tests pass)
4. **Frontend Services**: HTTP services and models
5. **Frontend Components**: UI implementation
6. **Integration**: End-to-end scenarios
7. **Polish**: Performance, validation, documentation

**Path Conventions**: Web app structure
- Backend: `mynotes/backend/src/`
- Frontend: `mynotes/frontend/src/`
- Tests: `mynotes/backend/test/`

---

## Phase 1: Database & Entities (Foundation)

- [x] **T001** Create TypeORM migration for new entities in `mynotes/backend/src/core/migrations/database-migrations.service.ts`
  - Add `updatedAt` column to `notes` table (already exists via @UpdateDateColumn)
  - Create `conversations` table (id, title, description, userId, createdAt, updatedAt)
  - Create `categories` table (id, name, type enum, userId nullable, createdAt, updatedAt)
  - Add `conversationId` nullable FK to `notes` table
  - Create `note_categories` junction table
  - Create `conversation_categories` junction table
  - Add indexes per data-model.md specifications

- [x] **T002** [P] Create Conversation entity in `mynotes/backend/src/conversations/entities/conversation.entity.ts`
  - Implement all fields per data-model.md
  - Configure relationships: User (N:1), Note (1:N), Category (N:M)
  - Set cascade rules: onDelete SET NULL for notes, CASCADE for categories

- [x] **T003** [P] Create Category entity in `mynotes/backend/src/categories/entities/category.entity.ts`
  - Implement fields with type enum ('system' | 'user')
  - Configure relationships: User (N:1 nullable), Note (N:M), Conversation (N:M)
  - Add unique composite index (name, userId, type)

- [x] **T004** Update Note entity in `mynotes/backend/src/shared/entities/note.entity.ts`
  - Add `conversationId` nullable FK field
  - Add `updatedAt` timestamp field (already exists via @UpdateDateColumn)
  - Add `categories` many-to-many relationship with @JoinTable
  - Configure cascade rules per research.md decisions

- [x] **T005** Create database seed migration in `mynotes/backend/src/core/migrations/database-migrations.service.ts`
  - Insert 5 system categories: Work, Personal, Ideas, Tasks, Reference
  - Set type='system' and userId=NULL for all entries
  - Use ON CONFLICT DO NOTHING for idempotency

---

## Phase 2: Backend Tests (TDD - MUST FAIL)

**⚠️ CRITICAL: All tests in this phase MUST be written and MUST FAIL before any implementation in Phase 3**

### Categories API Tests

- [x] **T006** [P] Contract test GET /api/categories in `mynotes/backend/test/e2e/categories.e2e-spec.ts`
  - Test listing system + user categories
  - Test filtering by type parameter
  - Test authentication requirement
  - ✅ 6 tests created - expecting 404 (TDD)

- [x] **T007** [P] Contract test POST /api/categories in `mynotes/backend/test/e2e/categories.e2e-spec.ts`
  - Test creating custom category
  - Test duplicate name validation
  - Test name length constraints (1-100 chars)
  - ✅ 8 tests created - expecting 404 (TDD)

- [x] **T008** [P] Contract test PUT /api/categories/:id in `mynotes/backend/test/e2e/categories.e2e-spec.ts`
  - Test updating custom category name
  - Test preventing system category modification
  - Test ownership validation
  - ✅ 9 tests created - expecting 404 (TDD)

- [x] **T009** [P] Contract test DELETE /api/categories/:id in `mynotes/backend/test/e2e/categories.e2e-spec.ts`
  - Test deleting custom category
  - Test preventing system category deletion
  - Test ownership validation
  - ✅ 6 tests created - expecting 404 (TDD)

- [x] **T010** [P] Contract test GET /api/categories/:id/notes in `mynotes/backend/test/e2e/categories.e2e-spec.ts`
  - Test fetching notes by category
  - Test pagination (limit, offset)
  - Test ownership filtering
  - ✅ 8 tests created - expecting 404 (TDD)

- [x] **T011** [P] Contract test GET /api/categories/:id/conversations in `mynotes/backend/test/e2e/categories.e2e-spec.ts`
  - Test fetching conversations by category
  - Test pagination (limit, offset)
  - Test ownership filtering
  - ✅ 8 tests created - expecting 404 (TDD)

### Conversations API Tests

- [x] **T012** [P] Contract test POST /api/conversations in `mynotes/backend/test/e2e/conversations.e2e-spec.ts`
  - Test creating conversation with title and description
  - Test validation (title required, 1-200 chars)
  - Test authentication requirement
  - ✅ 9 tests created - expecting 404 (TDD)

- [x] **T013** [P] Contract test GET /api/conversations in `mynotes/backend/test/e2e/conversations.e2e-spec.ts`
  - Test listing user's conversations
  - Test pagination and sorting (createdAt, updatedAt, title)
  - Test note count calculation
  - ✅ 8 tests created - expecting 404 (TDD)

- [x] **T014** [P] Contract test GET /api/conversations/:id in `mynotes/backend/test/e2e/conversations.e2e-spec.ts`
  - Test fetching conversation with notes
  - Test includeNotes query parameter
  - Test chronological note ordering
  - ✅ 7 tests created - expecting 404 (TDD)

- [x] **T015** [P] Contract test PUT /api/conversations/:id in `mynotes/backend/test/e2e/conversations.e2e-spec.ts`
  - Test updating conversation metadata
  - Test optional fields (title, description)
  - Test ownership validation
  - ✅ 10 tests created - expecting 404 (TDD)

- [x] **T016** [P] Contract test DELETE /api/conversations/:id in `mynotes/backend/test/e2e/conversations.e2e-spec.ts`
  - Test deleting conversation
  - Verify notes become standalone (conversationId = NULL)
  - Test ownership validation
  - ✅ 5 tests created - expecting 404 (TDD)

- [x] **T017** [P] Contract test POST /api/conversations/:id/notes in `mynotes/backend/test/e2e/conversations.e2e-spec.ts`
  - Test creating note directly in conversation
  - Test validation (title, content required)
  - Test ownership validation
  - ✅ 8 tests created - expecting 404 (TDD)

- [x] **T018** [P] Contract test PUT /api/conversations/:id/categories in `mynotes/backend/test/e2e/conversations.e2e-spec.ts`
  - Test assigning categories to conversation
  - Test validation (valid category IDs, available to user)
  - Test ownership validation
  - ✅ 10 tests created - expecting 404 (TDD)

### Notes API Tests (Extensions)

- [x] **T019** [P] Extend Notes E2E tests in `mynotes/backend/test/e2e/notes.e2e-spec.ts`
  - Add test for PUT /api/notes/:id (update note)
  - Add test for DELETE /api/notes/:id (delete note)
  - Add test for PATCH /api/notes/:id/conversation (assign/remove)
  - Add test for PUT /api/notes/:id/categories (update categories)
  - ✅ Extended with 12 new tests (36 total tests)

---

## Phase 3: Backend Implementation (Make Tests Pass)

### Categories Module

- [ ] **T020** Create CategoriesModule in `mynotes/backend/src/categories/categories.module.ts`
  - Import TypeOrmModule.forFeature([Category])
  - Declare CategoriesController and CategoriesService
  - Export CategoriesService for cross-module usage

- [ ] **T021** [P] Create DTOs in `mynotes/backend/src/categories/dto/`
  - CreateCategoryDto: name (required, 1-100 chars)
  - UpdateCategoryDto: name (required, 1-100 chars)
  - Use class-validator decorators per research.md

- [ ] **T022** Create CategoriesService in `mynotes/backend/src/categories/categories.service.ts`
  - Implement findAll(userId, type filter)
  - Implement create(userId, dto) with duplicate validation
  - Implement update(id, userId, dto) with ownership check
  - Implement remove(id, userId) with system category protection
  - Implement findNotesByCategory(id, userId, pagination)
  - Implement findConversationsByCategory(id, userId, pagination)

- [ ] **T023** Create CategoriesController in `mynotes/backend/src/categories/categories.controller.ts`
  - Implement GET /categories with type query param
  - Implement POST /categories with validation
  - Implement PUT /categories/:id with ownership validation
  - Implement DELETE /categories/:id with protection logic
  - Implement GET /categories/:id/notes with pagination
  - Implement GET /categories/:id/conversations with pagination
  - Add @UseGuards(JwtAuthGuard) to all endpoints

### Conversations Module

- [ ] **T024** Create ConversationsModule in `mynotes/backend/src/conversations/conversations.module.ts`
  - Import TypeOrmModule.forFeature([Conversation, Note, Category])
  - Declare ConversationsController and ConversationsService
  - Import CategoriesModule for category validation

- [ ] **T025** [P] Create DTOs in `mynotes/backend/src/conversations/dto/`
  - CreateConversationDto: title (required, 1-200), description (optional, max 2000)
  - UpdateConversationDto: title (optional, 1-200), description (optional, max 2000)
  - CreateNoteInConversationDto: title, content (both required)
  - AssignCategoriesDto: categoryIds (array of UUIDs)

- [ ] **T026** Create ConversationsService in `mynotes/backend/src/conversations/conversations.service.ts`
  - Implement create(userId, dto)
  - Implement findAll(userId, pagination, sorting)
  - Implement findOne(id, userId, includeNotes)
  - Implement update(id, userId, dto)
  - Implement remove(id, userId) with cascade to notes
  - Implement createNoteInConversation(conversationId, userId, dto)
  - Implement updateCategories(id, userId, categoryIds)

- [ ] **T027** Create ConversationsController in `mynotes/backend/src/conversations/conversations.controller.ts`
  - Implement POST /conversations
  - Implement GET /conversations with query params
  - Implement GET /conversations/:id with includeNotes param
  - Implement PUT /conversations/:id
  - Implement DELETE /conversations/:id
  - Implement POST /conversations/:id/notes
  - Implement PUT /conversations/:id/categories
  - Add @UseGuards(JwtAuthGuard) to all endpoints

### Notes Module Extensions

- [ ] **T028** [P] Create UpdateNoteDto in `mynotes/backend/src/notes/dto/update-note.dto.ts`
  - title (optional, 1-200 chars)
  - content (optional)
  - Use @IsOptional() decorator pattern from research.md

- [ ] **T029** [P] Create AssignConversationDto in `mynotes/backend/src/notes/dto/assign-conversation.dto.ts`
  - conversationId (UUID or null)
  - Validate with @IsUUID() or @IsNull()

- [ ] **T030** Extend NotesService in `mynotes/backend/src/notes/notes.service.ts`
  - Add update(id, userId, dto) method
  - Add remove(id, userId) method with cascade handling
  - Add updateConversation(id, userId, conversationId) method
  - Add updateCategories(id, userId, categoryIds) method
  - Import and use CategoriesService for validation

- [ ] **T031** Extend NotesController in `mynotes/backend/src/notes/notes.controller.ts`
  - Add PUT /notes/:id endpoint
  - Add DELETE /notes/:id endpoint
  - Add PATCH /notes/:id/conversation endpoint
  - Add PUT /notes/:id/categories endpoint

- [ ] **T032** Update NotesModule in `mynotes/backend/src/notes/notes.module.ts`
  - Import TypeOrmModule.forFeature([Category]) for category relationship
  - Import CategoriesModule for category validation

---

## Phase 4: Frontend Services & Models

- [ ] **T033** [P] Create Conversation model in `mynotes/frontend/src/app/shared/models/conversation.model.ts`
  - Define Conversation interface matching API contract
  - Define CreateConversationRequest, UpdateConversationRequest interfaces

- [ ] **T034** [P] Create Category model in `mynotes/frontend/src/app/shared/models/category.model.ts`
  - Define Category interface with type enum
  - Define CreateCategoryRequest, UpdateCategoryRequest interfaces

- [ ] **T035** Update Note model in `mynotes/frontend/src/app/shared/models/note.model.ts`
  - Add conversationId (string | null) field
  - Add updatedAt (Date) field
  - Add categories (Category[]) field

- [ ] **T036** [P] Create ConversationService in `mynotes/frontend/src/app/shared/services/conversation.service.ts`
  - Implement RxJS BehaviorSubject for state management per research.md
  - Implement create(dto) → POST /api/conversations
  - Implement getAll(params) → GET /api/conversations
  - Implement getById(id, includeNotes) → GET /api/conversations/:id
  - Implement update(id, dto) → PUT /api/conversations/:id
  - Implement delete(id) → DELETE /api/conversations/:id
  - Implement createNote(id, dto) → POST /api/conversations/:id/notes
  - Implement updateCategories(id, categoryIds) → PUT /api/conversations/:id/categories

- [ ] **T037** [P] Create CategoryService in `mynotes/frontend/src/app/shared/services/category.service.ts`
  - Implement BehaviorSubject for categories$ observable
  - Implement loadCategories(type?) → GET /api/categories
  - Implement create(dto) → POST /api/categories
  - Implement update(id, dto) → PUT /api/categories/:id
  - Implement delete(id) → DELETE /api/categories/:id
  - Implement getNotes(id, params) → GET /api/categories/:id/notes
  - Implement getConversations(id, params) → GET /api/categories/:id/conversations

- [ ] **T038** Extend NoteService in `mynotes/frontend/src/app/shared/services/note.service.ts`
  - Add update(id, dto) → PUT /api/notes/:id
  - Add delete(id) → DELETE /api/notes/:id
  - Add updateConversation(id, conversationId) → PATCH /api/notes/:id/conversation
  - Add updateCategories(id, categoryIds) → PUT /api/notes/:id/categories
  - Update create() to include categories field

---

## Phase 5: Frontend Components - Categories

- [ ] **T039** [P] Create category-list component in `mynotes/frontend/src/app/features/categories/category-list/category-list.component.ts`
  - Display system and user categories separately
  - Subscribe to CategoryService.categories$ observable
  - Implement delete confirmation for user categories
  - Add create category button

- [ ] **T040** [P] Create category-selector component in `mynotes/frontend/src/app/features/categories/category-selector/category-selector.component.ts`
  - Multi-select dropdown for category assignment
  - Load categories via CategoryService
  - Emit selected category IDs via @Output()
  - Use Angular Material or similar UI library

- [ ] **T041** [P] Create category-form component in `mynotes/frontend/src/app/features/categories/category-form/category-form.component.ts`
  - Modal/dialog for creating/editing custom categories
  - Form validation (1-100 chars, required)
  - Handle create and update operations
  - Show error messages for duplicates

- [ ] **T042** Create categories feature module in `mynotes/frontend/src/app/features/categories/categories.module.ts` or standalone component wrapper
  - Register all category components
  - Import CategoryService
  - Configure routing if needed

---

## Phase 6: Frontend Components - Conversations

- [ ] **T043** [P] Create conversation-list component in `mynotes/frontend/src/app/features/conversations/conversation-list/conversation-list.component.ts`
  - Display user's conversations with note counts
  - Implement pagination and sorting
  - Subscribe to ConversationService observable
  - Add create conversation button
  - Navigate to conversation detail on click

- [ ] **T044** [P] Create conversation-detail component in `mynotes/frontend/src/app/features/conversations/conversation-detail/conversation-detail.component.ts`
  - Display conversation metadata (title, description)
  - Display notes in chronological order
  - Show conversation categories
  - Add edit and delete buttons
  - Allow creating new note in conversation

- [ ] **T045** [P] Create conversation-form component in `mynotes/frontend/src/app/features/conversations/conversation-form/conversation-form.component.ts`
  - Modal/dialog for creating/editing conversations
  - Form fields: title (required), description (optional)
  - Integrate category-selector for assignment
  - Handle create and update operations

- [ ] **T046** Create conversations feature module in `mynotes/frontend/src/app/features/conversations/conversations.module.ts` or standalone wrapper
  - Register all conversation components
  - Import ConversationService, CategoryService
  - Configure routing (list, detail routes)

---

## Phase 7: Frontend Components - Notes Enhancement

- [ ] **T047** Update note-form component in `mynotes/frontend/src/app/features/notes/note-form/note-form.component.ts`
  - Add category-selector integration
  - Add conversation assignment dropdown (optional)
  - Support edit mode (populate existing note data)
  - Handle update operation via NoteService.update()

- [ ] **T048** Update note-list component in `mynotes/frontend/src/app/features/notes/note-list/note-list.component.ts`
  - Add edit button for each note
  - Add delete button with confirmation dialog
  - Display note categories as chips/badges
  - Show conversation indicator if note belongs to one

- [ ] **T049** Update note-detail component (if exists) in `mynotes/frontend/src/app/features/notes/note-detail/note-detail.component.ts`
  - Display note categories
  - Display conversation link
  - Add edit and delete buttons
  - Show createdAt and updatedAt timestamps

---

## Phase 8: Integration & Testing

- [ ] **T050** Execute Quickstart Scenario 1 from `specs/001-right-now-you/quickstart.md`
  - Complete note lifecycle: create → edit → assign categories → add to conversation → remove from conversation → delete
  - Verify all API endpoints respond correctly
  - Document any issues found

- [ ] **T051** Execute Quickstart Scenario 2 from `specs/001-right-now-you/quickstart.md`
  - Conversation management: create → add note → view conversation → edit metadata → delete conversation
  - Verify notes become standalone after conversation deletion
  - Document any issues found

- [ ] **T052** Execute Quickstart Scenario 3 from `specs/001-right-now-you/quickstart.md`
  - Category system: list system categories → create custom → assign to note → assign to conversation → filter by category → edit custom → delete custom
  - Verify category associations preserved after category deletion
  - Document any issues found

---

## Dependencies

**Critical Path**:
- T001-T005 (Database) → T006-T019 (Tests) → T020-T032 (Backend) → T033-T038 (Services) → T039-T049 (UI) → T050-T052 (Integration)

**Parallel Opportunities**:
- T002, T003, T004 can run in parallel (different entities)
- T006-T011 can run in parallel (different test files)
- T012-T018 can run in parallel (different test files)
- T021, T025, T028, T029 can run in parallel (different DTO files)
- T033, T034 can run in parallel (different model files)
- T036, T037 can run in parallel (different service files)
- T039-T041 can run in parallel (different components)
- T043-T045 can run in parallel (different components)

**Blocking Dependencies**:
- T020-T023 requires T006-T011 to be failing
- T024-T027 requires T012-T018 to be failing
- T028-T032 requires T019 to be failing
- T030 requires T022 (needs CategoriesService)
- T036-T038 require T033-T035 (models)
- T039-T041 require T037 (CategoryService)
- T043-T045 require T036, T037 (services)
- T047-T049 require T036, T037, T038 (services)
- T050-T052 require all previous tasks complete

---

## Parallel Execution Examples

**Example 1: Entity Creation (Phase 1)**
```bash
# Run T002, T003, T004 in parallel (different entity files)
Task: "Create Conversation entity"
Task: "Create Category entity"
Task: "Update Note entity"
```

**Example 2: Backend Tests (Phase 2)**
```bash
# Run all category tests in parallel (T006-T011)
Task: "Contract test GET /api/categories"
Task: "Contract test POST /api/categories"
Task: "Contract test PUT /api/categories/:id"
Task: "Contract test DELETE /api/categories/:id"
Task: "Contract test GET /api/categories/:id/notes"
Task: "Contract test GET /api/categories/:id/conversations"
```

**Example 3: Frontend Services (Phase 4)**
```bash
# Run T036, T037 in parallel (different service files)
Task: "Create ConversationService"
Task: "Create CategoryService"
```

---

## Validation Checklist

**Pre-Implementation (Phase 2 Gate)**:
- [ ] All 18 API endpoint tests written (T006-T019)
- [ ] All tests execute and FAIL with 404 or appropriate error
- [ ] Tests follow contract specifications from `contracts/api-specification.md`
- [ ] Test coverage includes success, error, validation, and ownership scenarios

**Post-Backend (Phase 3 Gate)**:
- [ ] All E2E tests now PASS (T006-T019 green)
- [ ] CategoriesService prevents system category modification/deletion
- [ ] Cascade deletion works correctly (conversation delete → notes standalone)
- [ ] Category uniqueness enforced (name + userId + type)

**Post-Frontend (Phase 5-7 Gate)**:
- [ ] All components render without errors
- [ ] Category selector shows system + user categories
- [ ] Conversation detail displays notes chronologically
- [ ] Edit/delete operations work with confirmation dialogs

**Final Integration (Phase 8 Gate)**:
- [ ] All quickstart scenarios execute successfully
- [ ] No console errors in browser or server logs
- [ ] Performance targets met (<200ms API, <2s page load)
- [ ] Manual testing checklist complete

---

## Notes

**TDD Discipline**: Tests in Phase 2 MUST fail before any implementation in Phase 3. This ensures contract-driven development.

**Parallel Execution**: Tasks marked [P] can run simultaneously as they modify different files and have no dependencies. Maximum parallelism: 6 tasks.

**Commit Strategy**: Commit after each task or after logical groups (e.g., all category tests, all category implementation).

**Risk Areas**:
- Many-to-many relationships: Verify TypeORM junction tables work correctly
- Cascade deletion: Test edge cases (conversation with many notes, note with many categories)
- Category uniqueness: Ensure composite unique constraint works as expected
- Frontend state management: BehaviorSubject pattern may need refinement based on usage patterns

**Estimated Effort**: 52 tasks × 30-45 min avg = ~26-39 hours total development time

---

**Status**: ✅ Ready for execution via `/implement` command or manual task-by-task implementation
