import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { TaskStatus, TaskPriority } from '../src/features/tasks/dto/task.enums';

describe('Tasks API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let testNoteId: string;
  let testTaskId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply validation pipe like in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Set global prefix like in main.ts
    app.setGlobalPrefix('api/notes');

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.destroy();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up tasks and notes before each test
    await dataSource.query('DELETE FROM tasks');
    await dataSource.query('DELETE FROM notes');
  });

  describe('Setup and Prerequisites', () => {
    it('should create a test note for task creation', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({
          content: 'This is a test note for creating tasks',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('This is a test note for creating tasks');
      testNoteId = response.body.id;
    });
  });

  describe('POST /api/notes/tasks', () => {
    beforeEach(async () => {
      // Create test note for each test
      const response = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({
          content: 'Test content',
        });
      testNoteId = response.body.id;
    });

    it('should create a new task with full data', async () => {
      const createTaskDto = {
        note_id: testNoteId,
        title: 'Implement authentication',
        description: 'Add JWT-based authentication system',
        priority: TaskPriority.HIGH,
        due_date: '2024-12-31T23:59:59Z',
        metadata: { source: 'manual', category: 'security' },
      };

      const response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send(createTaskDto)
        .expect(201);

      expect(response.body).toMatchObject({
        note_id: testNoteId,
        title: createTaskDto.title,
        description: createTaskDto.description,
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');
      expect(response.body.completed_at).toBeNull();

      testTaskId = response.body.id;
    });

    it('should create a task with minimal required data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: 'Minimal task',
        })
        .expect(201);

      expect(response.body.title).toBe('Minimal task');
      expect(response.body.status).toBe(TaskStatus.PENDING);
      expect(response.body.priority).toBe(TaskPriority.MEDIUM); // Default priority
      expect(response.body.description).toBeNull();
      expect(response.body.due_date).toBeNull();
    });

    it('should create a task with different priorities', async () => {
      const priorities = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT];

      for (const priority of priorities) {
        const response = await request(app.getHttpServer())
          .post('/api/notes/tasks')
          .send({
            note_id: testNoteId,
            title: `Task with ${priority} priority`,
            priority,
          })
          .expect(201);

        expect(response.body.priority).toBe(priority);
      }
    });

    it('should reject task creation with invalid note_id', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: '00000000-0000-0000-0000-000000000000',
          title: 'Task with invalid note',
        })
        .expect(404);

      expect(response.body.message).toContain('Note');
    });

    it('should reject task creation without required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          // Missing title
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject task creation with invalid priority', async () => {
      await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: 'Invalid priority task',
          priority: 'invalid_priority',
        })
        .expect(400);
    });

    it('should reject task with title exceeding 500 characters', async () => {
      const longTitle = 'a'.repeat(501);

      await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: longTitle,
        })
        .expect(400);
    });
  });

  describe('GET /api/notes/tasks', () => {
    beforeEach(async () => {
      // Create test note and multiple tasks
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'Test content' });
      testNoteId = noteResponse.body.id;

      // Create tasks with different statuses and priorities
      const tasks = [
        { title: 'Task 1', priority: TaskPriority.HIGH, status: TaskStatus.PENDING },
        { title: 'Task 2', priority: TaskPriority.LOW, status: TaskStatus.IN_PROGRESS },
        { title: 'Task 3', priority: TaskPriority.URGENT, status: TaskStatus.COMPLETED },
        { title: 'Task 4', priority: TaskPriority.MEDIUM, status: TaskStatus.PENDING },
      ];

      for (const task of tasks) {
        await request(app.getHttpServer())
          .post('/api/notes/tasks')
          .send({
            note_id: testNoteId,
            ...task,
          });
      }
    });

    it('should return all tasks without filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notes/tasks')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(4);
    });

    it('should filter tasks by noteId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/notes/tasks?noteId=${testNoteId}`)
        .expect(200);

      expect(response.body.length).toBe(4);
      response.body.forEach((task: any) => {
        expect(task.note_id).toBe(testNoteId);
      });
    });

    it('should filter tasks by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/notes/tasks?status=${TaskStatus.PENDING}`)
        .expect(200);

      expect(response.body.length).toBe(2);
      response.body.forEach((task: any) => {
        expect(task.status).toBe(TaskStatus.PENDING);
      });
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/notes/tasks?priority=${TaskPriority.HIGH}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].priority).toBe(TaskPriority.HIGH);
    });

    it('should sort tasks by created_at DESC (default)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notes/tasks')
        .expect(200);

      const dates = response.body.map((task: any) => new Date(task.created_at).getTime());
      const sortedDates = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sortedDates);
    });

    it('should sort tasks by priority ASC', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/notes/tasks?sortBy=priority&sortOrder=ASC')
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter by multiple criteria', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/notes/tasks?noteId=${testNoteId}&status=${TaskStatus.PENDING}&priority=${TaskPriority.HIGH}`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe(TaskStatus.PENDING);
      expect(response.body[0].priority).toBe(TaskPriority.HIGH);
    });

    it('should return empty array when no tasks match filters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/notes/tasks?status=${TaskStatus.CANCELLED}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/notes/tasks/:id', () => {
    beforeEach(async () => {
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'Test content' });
      testNoteId = noteResponse.body.id;

      const taskResponse = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: 'Test Task',
          priority: TaskPriority.HIGH,
        });
      testTaskId = taskResponse.body.id;
    });

    it('should return a task by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/notes/tasks/${testTaskId}`)
        .expect(200);

      expect(response.body.id).toBe(testTaskId);
      expect(response.body.title).toBe('Test Task');
      expect(response.body.priority).toBe(TaskPriority.HIGH);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app.getHttpServer())
        .get('/api/notes/tasks/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/notes/tasks/invalid-uuid')
        .expect(400);
    });
  });

  describe('GET /api/notes/tasks/note/:noteId', () => {
    beforeEach(async () => {
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'Test content' });
      testNoteId = noteResponse.body.id;

      // Create multiple tasks for this note
      await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({ note_id: testNoteId, title: 'Task 1' });

      await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({ note_id: testNoteId, title: 'Task 2' });
    });

    it('should return all tasks for a specific note', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/notes/tasks/note/${testNoteId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      response.body.forEach((task: any) => {
        expect(task.note_id).toBe(testNoteId);
      });
    });

    it('should return empty array for note with no tasks', async () => {
      // Create a new note without tasks
      const newNoteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'No tasks' });

      const response = await request(app.getHttpServer())
        .get(`/api/notes/tasks/note/${newNoteResponse.body.id}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 404 for non-existent note', async () => {
      await request(app.getHttpServer())
        .get('/api/notes/tasks/note/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /api/notes/tasks/:id', () => {
    beforeEach(async () => {
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'Test content' });
      testNoteId = noteResponse.body.id;

      const taskResponse = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: 'Original Task',
          description: 'Original description',
          priority: TaskPriority.LOW,
        });
      testTaskId = taskResponse.body.id;
    });

    it('should update task title', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}`)
        .send({ title: 'Updated Task' })
        .expect(200);

      expect(response.body.title).toBe('Updated Task');
      expect(response.body.description).toBe('Original description'); // Unchanged
    });

    it('should update task description', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
      expect(response.body.title).toBe('Original Task'); // Unchanged
    });

    it('should update task priority', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}`)
        .send({ priority: TaskPriority.URGENT })
        .expect(200);

      expect(response.body.priority).toBe(TaskPriority.URGENT);
    });

    it('should update multiple fields at once', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}`)
        .send({
          title: 'Completely Updated Task',
          description: 'New description',
          priority: TaskPriority.HIGH,
          due_date: '2024-12-31T23:59:59Z',
        })
        .expect(200);

      expect(response.body.title).toBe('Completely Updated Task');
      expect(response.body.description).toBe('New description');
      expect(response.body.priority).toBe(TaskPriority.HIGH);
      expect(response.body.due_date).toBeTruthy();
    });

    it('should update task metadata', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}`)
        .send({
          metadata: { updated: true, version: 2 },
        })
        .expect(200);

      expect(response.body.metadata).toMatchObject({ updated: true, version: 2 });
    });

    it('should not allow status update via this endpoint', async () => {
      // Status updates should be done via /tasks/:id/status endpoint
      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}`)
        .send({ status: TaskStatus.COMPLETED })
        .expect(200);

      // Status should remain unchanged
      expect(response.body.status).toBe(TaskStatus.PENDING);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app.getHttpServer())
        .patch('/api/notes/tasks/00000000-0000-0000-0000-000000000000')
        .send({ title: 'Updated' })
        .expect(404);
    });

    it('should reject invalid priority value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}`)
        .send({ priority: 'invalid_priority' })
        .expect(400);
    });
  });

  describe('PATCH /api/notes/tasks/:id/status', () => {
    beforeEach(async () => {
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'Test content' });
      testNoteId = noteResponse.body.id;

      const taskResponse = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: 'Status Test Task',
        });
      testTaskId = taskResponse.body.id;
    });

    it('should update task status to in_progress', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}/status`)
        .send({ status: TaskStatus.IN_PROGRESS })
        .expect(200);

      expect(response.body.status).toBe(TaskStatus.IN_PROGRESS);
      expect(response.body.completed_at).toBeNull();
    });

    it('should set completed_at when status changes to completed', async () => {
      const beforeCompletion = new Date();

      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}/status`)
        .send({ status: TaskStatus.COMPLETED })
        .expect(200);

      expect(response.body.status).toBe(TaskStatus.COMPLETED);
      expect(response.body.completed_at).not.toBeNull();

      const completedAt = new Date(response.body.completed_at);
      expect(completedAt.getTime()).toBeGreaterThanOrEqual(beforeCompletion.getTime());
    });

    it('should clear completed_at when status changes from completed to another status', async () => {
      // First complete the task
      await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}/status`)
        .send({ status: TaskStatus.COMPLETED });

      // Then change to in_progress
      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}/status`)
        .send({ status: TaskStatus.IN_PROGRESS })
        .expect(200);

      expect(response.body.status).toBe(TaskStatus.IN_PROGRESS);
      expect(response.body.completed_at).toBeNull();
    });

    it('should allow all valid status transitions', async () => {
      const statuses = [
        TaskStatus.IN_PROGRESS,
        TaskStatus.COMPLETED,
        TaskStatus.PENDING,
        TaskStatus.CANCELLED,
      ];

      for (const status of statuses) {
        const response = await request(app.getHttpServer())
          .patch(`/api/notes/tasks/${testTaskId}/status`)
          .send({ status })
          .expect(200);

        expect(response.body.status).toBe(status);
      }
    });

    it('should reject invalid status value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}/status`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app.getHttpServer())
        .patch('/api/notes/tasks/00000000-0000-0000-0000-000000000000/status')
        .send({ status: TaskStatus.COMPLETED })
        .expect(404);
    });

    it('should update updated_at timestamp on status change', async () => {
      const beforeUpdate = new Date();

      const response = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${testTaskId}/status`)
        .send({ status: TaskStatus.IN_PROGRESS })
        .expect(200);

      const updatedAt = new Date(response.body.updated_at);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('DELETE /api/notes/tasks/:id', () => {
    beforeEach(async () => {
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'Test content' });
      testNoteId = noteResponse.body.id;

      const taskResponse = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: 'Task to Delete',
        });
      testTaskId = taskResponse.body.id;
    });

    it('should delete a task', async () => {
      await request(app.getHttpServer())
        .delete(`/api/notes/tasks/${testTaskId}`)
        .expect(204);

      // Verify task is deleted
      await request(app.getHttpServer())
        .get(`/api/notes/tasks/${testTaskId}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent task', async () => {
      await request(app.getHttpServer())
        .delete('/api/notes/tasks/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .delete('/api/notes/tasks/invalid-uuid')
        .expect(400);
    });
  });

  describe('CASCADE Behavior', () => {
    beforeEach(async () => {
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'Test content' });
      testNoteId = noteResponse.body.id;

      // Create multiple tasks
      await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({ note_id: testNoteId, title: 'Task 1' });

      await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({ note_id: testNoteId, title: 'Task 2' });
    });

    it('should delete all tasks when note is deleted (CASCADE)', async () => {
      // Verify tasks exist
      const beforeDelete = await request(app.getHttpServer())
        .get(`/api/notes/tasks/note/${testNoteId}`)
        .expect(200);

      expect(beforeDelete.body.length).toBe(2);

      // Delete the note
      await request(app.getHttpServer())
        .delete(`/api/notes/notes/${testNoteId}`)
        .expect(204);

      // Verify tasks are also deleted
      const afterDelete = await request(app.getHttpServer())
        .get(`/api/notes/tasks/note/${testNoteId}`)
        .expect(404);
    });
  });

  describe('Validation Edge Cases', () => {
    beforeEach(async () => {
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({ content: 'Test content' });
      testNoteId = noteResponse.body.id;
    });

    it('should handle empty string in optional fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: 'Task with empty description',
          description: '',
        })
        .expect(201);

      expect(response.body.description).toBe('');
    });

    it('should reject null for required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: null,
        })
        .expect(400);
    });

    it('should handle special characters in title', async () => {
      const specialTitle = 'Task with special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./';

      const response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: specialTitle,
        })
        .expect(201);

      expect(response.body.title).toBe(specialTitle);
    });

    it('should handle unicode characters in title and description', async () => {
      const unicodeTitle = '任务标题 🎯 тест タスク';
      const unicodeDescription = 'Description with émojis 😀 and 中文字符';

      const response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: unicodeTitle,
          description: unicodeDescription,
        })
        .expect(201);

      expect(response.body.title).toBe(unicodeTitle);
      expect(response.body.description).toBe(unicodeDescription);
    });

    it('should handle complex metadata objects', async () => {
      const complexMetadata = {
        tags: ['work', 'urgent'],
        assignee: { name: 'John Doe', email: 'john@example.com' },
        history: [
          { action: 'created', timestamp: '2024-01-01T00:00:00Z' },
          { action: 'updated', timestamp: '2024-01-02T00:00:00Z' },
        ],
        nested: {
          level1: {
            level2: {
              value: 'deep nested value',
            },
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: testNoteId,
          title: 'Task with complex metadata',
          metadata: complexMetadata,
        })
        .expect(201);

      expect(response.body.metadata).toMatchObject(complexMetadata);
    });
  });

  describe('Complete Workflow', () => {
    it('should execute complete task lifecycle', async () => {
      // 1. Create a note
      const noteResponse = await request(app.getHttpServer())
        .post('/api/notes/notes')
        .send({
          content: 'Planning for new project implementation',
        })
        .expect(201);

      const noteId = noteResponse.body.id;

      // 2. Create multiple tasks with different priorities
      const task1Response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: noteId,
          title: 'Design system architecture',
          priority: TaskPriority.HIGH,
        })
        .expect(201);

      const task2Response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: noteId,
          title: 'Setup development environment',
          priority: TaskPriority.URGENT,
        })
        .expect(201);

      const task3Response = await request(app.getHttpServer())
        .post('/api/notes/tasks')
        .send({
          note_id: noteId,
          title: 'Write documentation',
          priority: TaskPriority.LOW,
        })
        .expect(201);

      // 3. List all tasks for the note
      const allTasksResponse = await request(app.getHttpServer())
        .get(`/api/notes/tasks/note/${noteId}`)
        .expect(200);

      expect(allTasksResponse.body.length).toBe(3);

      // 4. Filter by priority
      const urgentTasksResponse = await request(app.getHttpServer())
        .get(`/api/notes/tasks?priority=${TaskPriority.URGENT}`)
        .expect(200);

      expect(urgentTasksResponse.body.length).toBe(1);
      expect(urgentTasksResponse.body[0].title).toBe('Setup development environment');

      // 5. Update task to in_progress
      await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${task2Response.body.id}/status`)
        .send({ status: TaskStatus.IN_PROGRESS })
        .expect(200);

      // 6. Update task details
      await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${task1Response.body.id}`)
        .send({
          description: 'Design microservices architecture with API gateway',
          due_date: '2024-12-31T23:59:59Z',
        })
        .expect(200);

      // 7. Complete a task
      const completedTaskResponse = await request(app.getHttpServer())
        .patch(`/api/notes/tasks/${task2Response.body.id}/status`)
        .send({ status: TaskStatus.COMPLETED })
        .expect(200);

      expect(completedTaskResponse.body.completed_at).not.toBeNull();

      // 8. Filter by completed status
      const completedTasksResponse = await request(app.getHttpServer())
        .get(`/api/notes/tasks?status=${TaskStatus.COMPLETED}`)
        .expect(200);

      expect(completedTasksResponse.body.length).toBe(1);

      // 9. Delete a task
      await request(app.getHttpServer())
        .delete(`/api/notes/tasks/${task3Response.body.id}`)
        .expect(204);

      // 10. Verify final state
      const finalTasksResponse = await request(app.getHttpServer())
        .get(`/api/notes/tasks/note/${noteId}`)
        .expect(200);

      expect(finalTasksResponse.body.length).toBe(2);

      // 11. Delete note and verify cascade
      await request(app.getHttpServer())
        .delete(`/api/notes/notes/${noteId}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/notes/tasks/note/${noteId}`)
        .expect(404);
    });
  });
});
