import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TasksApiService } from './tasks-api.service';
import {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  TaskFilterParams,
  TaskStatus,
  TaskPriority
} from '../models/task.model';

describe('TasksApiService', () => {
  let service: TasksApiService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3005/api/notes/tasks';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TasksApiService]
    });
    service = TestBed.inject(TasksApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTasks', () => {
    it('should fetch all tasks without filters', () => {
      const mockTasks: Task[] = [
        {
          id: '1',
          note_id: 'note-1',
          title: 'Test task',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.PENDING,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z'
        }
      ];

      service.getTasks().subscribe(tasks => {
        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe('Test task');
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockTasks);
    });

    it('should fetch tasks with filters', () => {
      const filters: TaskFilterParams = {
        noteId: 'note-1',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      };

      const mockTasks: Task[] = [];

      service.getTasks(filters).subscribe(tasks => {
        expect(tasks).toEqual([]);
      });

      const req = httpMock.expectOne(
        req => req.url === baseUrl &&
        req.params.has('noteId') &&
        req.params.get('noteId') === 'note-1' &&
        req.params.get('status') === TaskStatus.PENDING &&
        req.params.get('priority') === TaskPriority.HIGH
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockTasks);
    });

    it('should handle date filters', () => {
      const filters: TaskFilterParams = {
        dueDateFrom: '2025-01-01',
        dueDateTo: '2025-12-31'
      };

      service.getTasks(filters).subscribe();

      const req = httpMock.expectOne(
        req => req.url === baseUrl &&
        req.params.get('dueDateFrom') === '2025-01-01' &&
        req.params.get('dueDateTo') === '2025-12-31'
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getTaskById', () => {
    it('should fetch a task by id', () => {
      const mockTask: Task = {
        id: '1',
        note_id: 'note-1',
        title: 'Test task',
        description: 'Task description',
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      service.getTaskById('1').subscribe(task => {
        expect(task.id).toBe('1');
        expect(task.title).toBe('Test task');
        expect(task.description).toBe('Task description');
      });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTask);
    });

    it('should handle 404 error for non-existent task', () => {
      service.getTaskById('999').subscribe(
        () => fail('should have failed'),
        error => {
          expect(error.status).toBe(404);
        }
      );

      const req = httpMock.expectOne(`${baseUrl}/999`);
      req.flush('Task not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('getTasksByNoteId', () => {
    it('should fetch all tasks for a specific note', () => {
      const mockTasks: Task[] = [
        {
          id: '1',
          note_id: 'note-1',
          title: 'Task 1',
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.PENDING,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z'
        },
        {
          id: '2',
          note_id: 'note-1',
          title: 'Task 2',
          priority: TaskPriority.HIGH,
          status: TaskStatus.COMPLETED,
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z'
        }
      ];

      service.getTasksByNoteId('note-1').subscribe(tasks => {
        expect(tasks.length).toBe(2);
        expect(tasks[0].note_id).toBe('note-1');
        expect(tasks[1].note_id).toBe('note-1');
      });

      const req = httpMock.expectOne('http://localhost:3005/api/notes/note-1/tasks');
      expect(req.request.method).toBe('GET');
      req.flush(mockTasks);
    });
  });

  describe('createTask', () => {
    it('should create a new task', () => {
      const createDto: CreateTaskDto = {
        note_id: 'note-1',
        title: 'New task',
        description: 'Task description',
        priority: TaskPriority.HIGH
      };

      const mockTask: Task = {
        id: '1',
        note_id: 'note-1',
        title: 'New task',
        description: 'Task description',
        priority: TaskPriority.HIGH,
        status: TaskStatus.PENDING,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      service.createTask(createDto).subscribe(task => {
        expect(task.id).toBe('1');
        expect(task.title).toBe('New task');
        expect(task.status).toBe(TaskStatus.PENDING);
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createDto);
      req.flush(mockTask);
    });

    it('should handle validation errors', () => {
      const invalidDto: CreateTaskDto = {
        note_id: '',
        title: ''
      };

      service.createTask(invalidDto).subscribe(
        () => fail('should have failed'),
        error => {
          expect(error.status).toBe(400);
        }
      );

      const req = httpMock.expectOne(baseUrl);
      req.flush('Validation failed', { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('updateTask', () => {
    it('should update a task', () => {
      const updateDto: UpdateTaskDto = {
        title: 'Updated task',
        priority: TaskPriority.URGENT,
        description: 'Updated description'
      };

      const mockTask: Task = {
        id: '1',
        note_id: 'note-1',
        title: 'Updated task',
        description: 'Updated description',
        priority: TaskPriority.URGENT,
        status: TaskStatus.PENDING,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z'
      };

      service.updateTask('1', updateDto).subscribe(task => {
        expect(task.title).toBe('Updated task');
        expect(task.priority).toBe(TaskPriority.URGENT);
      });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateDto);
      req.flush(mockTask);
    });

    it('should update with partial data', () => {
      const updateDto: UpdateTaskDto = {
        title: 'Only title updated'
      };

      const mockTask: Task = {
        id: '1',
        note_id: 'note-1',
        title: 'Only title updated',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z'
      };

      service.updateTask('1', updateDto).subscribe(task => {
        expect(task.title).toBe('Only title updated');
      });

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('PATCH');
      req.flush(mockTask);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status to completed', () => {
      const statusDto: UpdateTaskStatusDto = {
        status: TaskStatus.COMPLETED
      };

      const mockTask: Task = {
        id: '1',
        note_id: 'note-1',
        title: 'Test task',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.COMPLETED,
        completed_at: '2025-01-03T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z'
      };

      service.updateTaskStatus('1', statusDto).subscribe(task => {
        expect(task.status).toBe(TaskStatus.COMPLETED);
        expect(task.completed_at).toBeDefined();
      });

      const req = httpMock.expectOne(`${baseUrl}/1/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(statusDto);
      req.flush(mockTask);
    });

    it('should update task status to in_progress', () => {
      const statusDto: UpdateTaskStatusDto = {
        status: TaskStatus.IN_PROGRESS
      };

      const mockTask: Task = {
        id: '1',
        note_id: 'note-1',
        title: 'Test task',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z'
      };

      service.updateTaskStatus('1', statusDto).subscribe(task => {
        expect(task.status).toBe(TaskStatus.IN_PROGRESS);
        expect(task.completed_at).toBeUndefined();
      });

      const req = httpMock.expectOne(`${baseUrl}/1/status`);
      expect(req.request.method).toBe('PATCH');
      req.flush(mockTask);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', () => {
      service.deleteTask('1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should handle 404 error for non-existent task', () => {
      service.deleteTask('999').subscribe(
        () => fail('should have failed'),
        error => {
          expect(error.status).toBe(404);
        }
      );

      const req = httpMock.expectOne(`${baseUrl}/999`);
      req.flush('Task not found', { status: 404, statusText: 'Not Found' });
    });
  });
});
