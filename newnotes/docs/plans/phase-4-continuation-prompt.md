# 🚀 Prompt for Next Implementation Phase

## Continue Notes System Implementation - Phase 4: Task Management API

**Context:**
You have successfully completed Phases 1-3 of the Notes System Implementation:
- ✅ **Phase 1:** Backend Foundation (NestJS, TypeORM, PostgreSQL, Health checks, Notes CRUD)
- ✅ **Phase 1.5:** Basic Frontend (Angular 20, Material Design, Note list/editor components)
- ✅ **Phase 2:** Event System (Redis Pub/Sub, Event schemas, Event publishing)
- ✅ **Phase 3:** LLM Task Agent (Ollama integration, Task extraction, Event-driven processing)

**Current System State:**
- Backend running on `http://localhost:3005`
- Frontend running on `http://localhost:4200`
- PostgreSQL with `notes` and `tasks` tables (tasks have CASCADE delete on note deletion)
- Redis Pub/Sub operational for event-driven task extraction
- LLM automatically extracts tasks from notes with confidence >= 0.5
- DeepSeek-R1:32B model integrated via Ollama

**What's Next:**
Implement **Phase 4: Task Management API** to provide CRUD operations for the extracted tasks.

**Your Task:**
Create a complete RESTful API for task management that allows users to:
1. List all tasks (with filtering by note, status, priority)
2. Get individual task details
3. Update task status (pending → in_progress → completed)
4. Update task properties (title, description, priority, due_date)
5. Delete tasks manually (in addition to CASCADE delete)
6. Mark tasks as complete with completed_at timestamp

**Requirements:**
- Follow the existing NestJS modular architecture (core/features/shared)
- Use TDD approach (write tests first)
- Create DTOs for request/response validation
- Implement proper error handling
- Add API documentation with Swagger/OpenAPI
- Use the existing TaskRepository from Phase 3
- Configure with environment variables (no hardcoded values)
- Ensure all tests pass before completion

**Technical Specifications:**
- **Module:** `src/features/tasks/` (new feature module)
- **Controller:** TasksController with routes under `/api/notes/tasks`
- **Service:** TasksService (delegates to TaskRepository)
- **DTOs:** CreateTaskDto, UpdateTaskDto, TaskFilterDto
- **Endpoints:**
  - `GET /api/notes/tasks` - List all tasks with optional filters
  - `GET /api/notes/tasks/:id` - Get task by ID
  - `GET /api/notes/tasks/note/:noteId` - Get tasks for specific note
  - `PATCH /api/notes/tasks/:id` - Update task
  - `PATCH /api/notes/tasks/:id/status` - Update task status
  - `DELETE /api/notes/tasks/:id` - Delete task

**Architecture Notes:**
- Reuse existing `TaskRepository` from `src/features/llm-service/repositories/task.repository.ts`
- Follow the same patterns as NotesModule for consistency
- Add validation using class-validator
- Use NestJS Guards for authorization (prepare for future auth integration)

**Reference Documents:**
- Implementation Plan: `docs/plans/2025-10-28-notes-system-implementation.md`
- Design Document: `docs/plans/2025-10-28-notes-system-design.md`
- Existing Task Entity: `src/shared/entities/task.entity.ts`
- Existing Task Repository: `src/features/llm-service/repositories/task.repository.ts`

**Use the superpowers:executing-plans skill** to implement this phase systematically with proper planning, testing, and validation.

---

**How to Use This Prompt:**
Copy and paste this entire prompt to Claude Code to continue the implementation with Phase 4.
