# Task Management API Architecture

## Overview
This document defines the complete architecture for the Task Management API, following NestJS best practices and the existing codebase patterns. The API provides full CRUD operations for tasks with filtering, status management, and relationship handling.

## Module Structure

```
src/features/tasks/
├── tasks.module.ts              # Feature module configuration
├── controllers/
│   └── tasks.controller.ts      # HTTP endpoint definitions
├── services/
│   └── tasks.service.ts         # Business logic layer
├── dto/
│   ├── create-task.dto.ts       # Task creation validation
│   ├── update-task.dto.ts       # Task update validation
│   ├── update-task-status.dto.ts # Status update validation
│   └── task-filter.dto.ts       # Query filtering validation
└── __tests__/
    ├── tasks.controller.spec.ts  # Controller unit tests
    └── tasks.service.spec.ts     # Service unit tests
```

## API Endpoints

### GET /api/notes/tasks
**Purpose**: List all tasks with optional filtering

**Query Parameters**:
- `noteId` (optional, UUID): Filter by note ID
- `status` (optional, string): Filter by status (pending, in_progress, completed, cancelled)
- `priority` (optional, string): Filter by priority (low, medium, high, urgent)
- `dueDateFrom` (optional, ISO date): Filter tasks due after this date
- `dueDateTo` (optional, ISO date): Filter tasks due before this date
- `sortBy` (optional, string): Sort field (created_at, due_date, priority, status)
- `sortOrder` (optional, string): Sort order (ASC, DESC)

**Response** (200):
```typescript
{
  data: Task[],
  meta: {
    total: number,
    filtered: number
  }
}
```

**Error Responses**:
- 400: Invalid query parameters (validation error)
- 500: Internal server error

**Example**:
```
GET /api/notes/tasks?noteId=uuid&status=pending&priority=high
```

---

### GET /api/notes/tasks/:id
**Purpose**: Get a single task by ID

**Path Parameters**:
- `id` (UUID): Task identifier

**Response** (200):
```typescript
{
  id: string,
  note_id: string,
  title: string,
  description: string | null,
  status: string,
  priority: string,
  due_date: Date | null,
  completed_at: Date | null,
  created_at: Date,
  updated_at: Date,
  llm_confidence: number | null,
  metadata: Record<string, any> | null
}
```

**Error Responses**:
- 404: Task not found
- 400: Invalid UUID format
- 500: Internal server error

---

### GET /api/notes/:noteId/tasks
**Purpose**: Get all tasks for a specific note

**Path Parameters**:
- `noteId` (UUID): Note identifier

**Response** (200):
```typescript
{
  data: Task[],
  meta: {
    noteId: string,
    total: number
  }
}
```

**Error Responses**:
- 404: Note not found
- 400: Invalid UUID format
- 500: Internal server error

---

### POST /api/notes/tasks
**Purpose**: Create a new task

**Request Body**:
```typescript
{
  note_id: string,        // Required, UUID
  title: string,          // Required, max 500 chars
  description?: string,   // Optional, text
  priority?: string,      // Optional, default: 'medium'
  due_date?: Date,        // Optional, ISO date string
  metadata?: Record<string, any> // Optional
}
```

**Response** (201):
```typescript
{
  id: string,
  note_id: string,
  title: string,
  description: string | null,
  status: 'pending',
  priority: string,
  due_date: Date | null,
  completed_at: null,
  created_at: Date,
  updated_at: Date,
  llm_confidence: null,
  metadata: Record<string, any> | null
}
```

**Error Responses**:
- 400: Validation error (missing required fields, invalid format)
- 404: Note not found
- 500: Internal server error

---

### PATCH /api/notes/tasks/:id
**Purpose**: Update task properties (excluding status)

**Path Parameters**:
- `id` (UUID): Task identifier

**Request Body** (all fields optional):
```typescript
{
  title?: string,         // Max 500 chars
  description?: string,   // Text
  priority?: string,      // low, medium, high, urgent
  due_date?: Date,        // ISO date string
  metadata?: Record<string, any>
}
```

**Response** (200):
```typescript
{
  // Updated task object
}
```

**Error Responses**:
- 404: Task not found
- 400: Validation error
- 500: Internal server error

---

### PATCH /api/notes/tasks/:id/status
**Purpose**: Update task status with automatic completed_at handling

**Path Parameters**:
- `id` (UUID): Task identifier

**Request Body**:
```typescript
{
  status: string // Required: pending, in_progress, completed, cancelled
}
```

**Response** (200):
```typescript
{
  id: string,
  status: string,
  completed_at: Date | null, // Set to current time if status='completed'
  updated_at: Date
}
```

**Business Rules**:
- When status changes to 'completed': `completed_at` = current timestamp
- When status changes from 'completed' to any other: `completed_at` = null

**Error Responses**:
- 404: Task not found
- 400: Invalid status value
- 500: Internal server error

---

### DELETE /api/notes/tasks/:id
**Purpose**: Delete a task

**Path Parameters**:
- `id` (UUID): Task identifier

**Response** (204):
- No content

**Error Responses**:
- 404: Task not found
- 400: Invalid UUID format
- 500: Internal server error

---

## Service Layer Design

### TasksService Methods

```typescript
@Injectable()
export class TasksService {
  constructor(
    private readonly taskRepository: TaskRepository,
  ) {}

  /**
   * Find all tasks with optional filtering
   * Delegates to TaskRepository with QueryBuilder for complex filters
   */
  async findAll(filters: TaskFilterDto): Promise<{ data: Task[]; meta: any }>;

  /**
   * Find single task by ID
   * Throws NotFoundException if not found
   */
  async findOne(id: string): Promise<Task>;

  /**
   * Find all tasks for a specific note
   * Validates note existence
   * Delegates to TaskRepository.findTasksByNoteId
   */
  async findByNoteId(noteId: string): Promise<{ data: Task[]; meta: any }>;

  /**
   * Create new task
   * Validates note exists
   * Sets default values (status='pending')
   */
  async create(createTaskDto: CreateTaskDto): Promise<Task>;

  /**
   * Update task properties (not status)
   * Validates task exists
   * Excludes status field from updates
   */
  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task>;

  /**
   * Update task status
   * Handles completed_at logic
   * Delegates to TaskRepository.updateTaskStatus
   */
  async updateStatus(id: string, status: string): Promise<Task>;

  /**
   * Delete task
   * Validates task exists
   */
  async remove(id: string): Promise<void>;
}
```

### Business Logic

1. **Note Validation**: Before creating tasks, verify the note exists
2. **Status Transition Rules**:
   - Only allow valid status values (pending, in_progress, completed, cancelled)
   - Automatically set/clear `completed_at` based on status
3. **Priority Validation**: Ensure priority is one of: low, medium, high, urgent
4. **Date Validation**: Validate due_date is not in the past (optional business rule)
5. **Error Handling**: Use NestJS standard exceptions (NotFoundException, BadRequestException)

### Error Handling Strategy

```typescript
// Use NestJS standard exceptions
throw new NotFoundException(`Task with ID ${id} not found`);
throw new BadRequestException('Invalid status value');
throw new InternalServerErrorException('Failed to update task');

// TaskRepository errors should throw, caught and transformed by service
try {
  return await this.taskRepository.updateTaskStatus(id, status);
} catch (error) {
  if (error.message.includes('not found')) {
    throw new NotFoundException(error.message);
  }
  throw new InternalServerErrorException('Failed to update task status');
}
```

---

## DTO Specifications

### CreateTaskDto

```typescript
import { IsString, IsUUID, IsOptional, IsEnum, MaxLength, IsDateString, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsUUID()
  note_id: string;

  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: string = 'medium';

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
```

**Validation Rules**:
- `note_id`: Required, must be valid UUID
- `title`: Required, max 500 characters, non-empty
- `description`: Optional, string
- `priority`: Optional, enum validation, defaults to 'medium'
- `due_date`: Optional, ISO 8601 date string
- `metadata`: Optional, JSON object

---

### UpdateTaskDto

```typescript
import { IsString, IsOptional, IsEnum, MaxLength, IsDateString, IsObject } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
```

**Validation Rules**:
- All fields optional
- Same validation rules as CreateTaskDto for provided fields
- **Excludes status** - use separate endpoint for status updates

---

### UpdateTaskStatusDto

```typescript
import { IsEnum } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsEnum(['pending', 'in_progress', 'completed', 'cancelled'])
  status: string;
}
```

**Validation Rules**:
- `status`: Required, must be one of the allowed values
- Separate DTO ensures status updates are intentional and validated

---

### TaskFilterDto

```typescript
import { IsOptional, IsUUID, IsEnum, IsDateString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class TaskFilterDto {
  @IsOptional()
  @IsUUID()
  noteId?: string;

  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @IsOptional()
  @IsIn(['created_at', 'due_date', 'priority', 'status'])
  sortBy?: string = 'created_at';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: string = 'DESC';
}
```

**Validation Rules**:
- All fields optional (for flexible filtering)
- Enum validation for predefined values
- ISO 8601 date strings for date filters
- Sort parameters with allowed values

---

## Integration Strategy

### TaskRepository Reuse

**Existing Methods to Leverage**:
```typescript
// Already implemented in TaskRepository
createTasksForNote(noteId: string, tasks: ExtractedTask[]): Promise<Task[]>
findTasksByNoteId(noteId: string): Promise<Task[]>
updateTaskStatus(taskId: string, status: string): Promise<Task>
```

**New Methods Needed**:
```typescript
// Add to TaskRepository
async findAll(filters: TaskFilterDto): Promise<Task[]> {
  const queryBuilder = this.taskRepository.createQueryBuilder('task');

  if (filters.noteId) {
    queryBuilder.andWhere('task.note_id = :noteId', { noteId: filters.noteId });
  }

  if (filters.status) {
    queryBuilder.andWhere('task.status = :status', { status: filters.status });
  }

  if (filters.priority) {
    queryBuilder.andWhere('task.priority = :priority', { priority: filters.priority });
  }

  if (filters.dueDateFrom) {
    queryBuilder.andWhere('task.due_date >= :from', { from: filters.dueDateFrom });
  }

  if (filters.dueDateTo) {
    queryBuilder.andWhere('task.due_date <= :to', { to: filters.dueDateTo });
  }

  queryBuilder.orderBy(
    `task.${filters.sortBy}`,
    filters.sortOrder as 'ASC' | 'DESC'
  );

  return await queryBuilder.getMany();
}

async findOne(id: string): Promise<Task | null> {
  return await this.taskRepository.findOne({ where: { id } });
}

async create(taskData: Partial<Task>): Promise<Task> {
  const task = this.taskRepository.create(taskData);
  return await this.taskRepository.save(task);
}

async update(id: string, taskData: Partial<Task>): Promise<Task> {
  await this.taskRepository.update(id, taskData);
  const updated = await this.findOne(id);
  if (!updated) {
    throw new Error(`Task with ID ${id} not found`);
  }
  return updated;
}

async delete(id: string): Promise<void> {
  const result = await this.taskRepository.delete(id);
  if (result.affected === 0) {
    throw new Error(`Task with ID ${id} not found`);
  }
}
```

### Module Dependencies

**tasks.module.ts**:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './controllers/tasks.controller';
import { TasksService } from './services/tasks.service';
import { TaskRepository } from '../llm-service/repositories/task.repository';
import { Task } from '@shared/entities/task.entity';
import { Note } from '@shared/entities/note.entity';
import { NotesModule } from '../notes/notes.module'; // For note validation

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Note]),
    NotesModule, // Import to access NotesService for validation
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskRepository],
  exports: [TasksService, TaskRepository],
})
export class TasksModule {}
```

### AppModule Integration

```typescript
// In app.module.ts
import { TasksModule } from './features/tasks/tasks.module';

@Module({
  imports: [
    // ... other modules
    TasksModule,
  ],
})
export class AppModule {}
```

### Testing Approach

**Unit Tests**:
1. **TasksController Tests**: Mock TasksService, verify HTTP layer behavior
2. **TasksService Tests**: Mock TaskRepository, verify business logic
3. **DTO Validation Tests**: Test class-validator rules

**Integration Tests**:
1. Test full request/response cycle with real database
2. Verify status update logic with completed_at
3. Test filtering with various combinations
4. Verify error responses (404, 400, 500)

**Test Structure**:
```typescript
describe('TasksService', () => {
  let service: TasksService;
  let repository: MockType<TaskRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: TaskRepository, useFactory: mockTaskRepository },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get(TaskRepository);
  });

  describe('findAll', () => {
    it('should return filtered tasks', async () => {
      // Test implementation
    });
  });

  describe('updateStatus', () => {
    it('should set completed_at when status is completed', async () => {
      // Test implementation
    });

    it('should clear completed_at when status changes from completed', async () => {
      // Test implementation
    });
  });
});
```

---

## Implementation Order

### Phase 1: Repository Extensions
1. Add new methods to TaskRepository (findAll, findOne, create, update, delete)
2. Write unit tests for repository methods
3. Verify existing methods still work

### Phase 2: DTOs
1. Create CreateTaskDto with validation
2. Create UpdateTaskDto with validation
3. Create UpdateTaskStatusDto with validation
4. Create TaskFilterDto with validation
5. Write DTO validation tests

### Phase 3: Service Layer
1. Implement TasksService with all methods
2. Add business logic for note validation
3. Implement error handling
4. Write comprehensive unit tests
5. Verify integration with TaskRepository

### Phase 4: Controller Layer
1. Implement TasksController with all endpoints
2. Add route validation and transformation
3. Implement response formatting
4. Write controller unit tests
5. Document API with Swagger decorators (optional)

### Phase 5: Module Integration
1. Create TasksModule
2. Configure imports and exports
3. Add to AppModule
4. Write integration tests

### Phase 6: Testing & Validation
1. Run all unit tests
2. Execute integration tests
3. Test with Postman/REST client
4. Verify error scenarios
5. Performance testing with filters

### Phase 7: Documentation
1. Add JSDoc comments to all methods
2. Create API documentation (Swagger/OpenAPI)
3. Write developer guide
4. Update project README

---

## API Design Decisions

### Separation of Concerns
- **Controllers**: Handle HTTP concerns, validation, routing
- **Services**: Contain business logic, orchestration
- **Repository**: Handle data access, TypeORM interactions

### Status Update Separation
Separate endpoint for status updates (`PATCH /tasks/:id/status`) ensures:
- Intentional status changes
- Automatic completed_at handling
- Clear audit trail
- Prevents accidental status changes

### Filtering Flexibility
Query-based filtering allows:
- Multiple filter combinations
- Optional sorting
- Easy to extend
- RESTful design

### Error Handling Strategy
- Use NestJS standard exceptions
- Consistent error response format
- Meaningful error messages
- Proper HTTP status codes

### Validation Strategy
- Use class-validator decorators
- Validate at DTO level
- Business logic validation in service
- Clear validation error messages

---

## Security Considerations

1. **Input Validation**: All user input validated through DTOs
2. **UUID Validation**: Prevent SQL injection through UUID validation
3. **SQL Injection**: Use TypeORM query builders with parameterized queries
4. **Rate Limiting**: Consider adding rate limiting to endpoints (future)
5. **Authentication**: Add JWT authentication guards (future)
6. **Authorization**: Verify user owns the note/task (future)

---

## Performance Considerations

1. **Database Indexes**: Ensure indexes on `note_id`, `status`, `priority`, `due_date`
2. **Query Optimization**: Use QueryBuilder for efficient filtering
3. **Pagination**: Consider adding pagination for large result sets (future)
4. **Caching**: Consider Redis caching for frequently accessed tasks (future)
5. **Batch Operations**: Support bulk status updates (future enhancement)

---

## Future Enhancements

1. **Pagination**: Add limit/offset to task listing
2. **Search**: Full-text search on title/description
3. **Task Dependencies**: Link tasks with dependencies
4. **Recurring Tasks**: Support recurring task patterns
5. **Task History**: Track all status changes
6. **Bulk Operations**: Bulk status updates, bulk delete
7. **Websockets**: Real-time task updates
8. **Task Templates**: Predefined task templates
9. **Task Comments**: Add commenting system
10. **Task Attachments**: File attachments to tasks

---

## Summary

The Task Management API provides 7 RESTful endpoints for complete task lifecycle management. The architecture follows NestJS best practices with clear separation of concerns, robust validation through 4 DTOs (CreateTaskDto, UpdateTaskDto, UpdateTaskStatusDto, TaskFilterDto), and comprehensive error handling. The service layer implements 7 core methods that delegate to the TaskRepository while adding business logic. Implementation follows a 7-phase approach starting with repository extensions, then DTOs, service layer, controller layer, module integration, testing, and documentation. The design prioritizes code reusability, maintainability, and extensibility while adhering to SOLID principles.
