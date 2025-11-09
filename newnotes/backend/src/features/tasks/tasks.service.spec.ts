import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskRepository } from '../llm-service/repositories/task.repository';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task, TaskSource } from '../../shared/entities/task.entity';
import { TaskStatus, TaskPriority } from './dto/task.enums';
import { RedisService } from '@core/redis/redis.service';
import { TaskContextService } from './services/task-context.service';

describe('TasksService', () => {
  let service: TasksService;
  let repository: TaskRepository;

  const mockTask: Task = {
    id: 'task-uuid-1',
    note_id: 'note-uuid-1',
    title: 'Test Task',
    description: 'Test Description',
    status: 'pending',
    priority: 'medium',
    due_date: new Date('2024-12-31'),
    completed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    llm_confidence: 0.95,
    metadata: { source: 'test' },
    note: null,
    source: TaskSource.MANUAL,
    parent_task_id: null,
    parent_task: null,
    level: 0,
    order_index: 0,
    children: [],
  };

  const mockTaskRepository = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findTasksByNoteId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateTaskStatus: jest.fn(),
    delete: jest.fn(),
    createTasksForNote: jest.fn(),
  };

  const mockRedisService = {
    publish: jest.fn(),
  };

  const mockTaskContextService = {
    createContext: jest.fn(),
    findByTaskId: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: TaskRepository,
          useValue: mockTaskRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: TaskContextService,
          useValue: mockTaskContextService,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get<TaskRepository>(TaskRepository);

    // Clear all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all tasks without filters', async () => {
      const filters: TaskFilterDto = {};
      const expectedTasks = [mockTask];

      mockTaskRepository.findAll.mockResolvedValue(expectedTasks);

      const result = await service.findAll(filters);

      expect(result).toEqual(expectedTasks);
      expect(repository.findAll).toHaveBeenCalledWith(filters);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return filtered tasks by noteId', async () => {
      const filters: TaskFilterDto = { noteId: 'note-uuid-1' };
      const expectedTasks = [mockTask];

      mockTaskRepository.findAll.mockResolvedValue(expectedTasks);

      const result = await service.findAll(filters);

      expect(result).toEqual(expectedTasks);
      expect(repository.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return filtered tasks by status', async () => {
      const filters: TaskFilterDto = { status: TaskStatus.PENDING };
      const expectedTasks = [mockTask];

      mockTaskRepository.findAll.mockResolvedValue(expectedTasks);

      const result = await service.findAll(filters);

      expect(result).toEqual(expectedTasks);
      expect(repository.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return filtered tasks by priority', async () => {
      const filters: TaskFilterDto = { priority: TaskPriority.HIGH };
      const highPriorityTask = { ...mockTask, priority: 'high' };

      mockTaskRepository.findAll.mockResolvedValue([highPriorityTask]);

      const result = await service.findAll(filters);

      expect(result).toEqual([highPriorityTask]);
      expect(repository.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return tasks filtered by date range', async () => {
      const filters: TaskFilterDto = {
        dueDateFrom: '2024-01-01',
        dueDateTo: '2024-12-31',
      };
      const expectedTasks = [mockTask];

      mockTaskRepository.findAll.mockResolvedValue(expectedTasks);

      const result = await service.findAll(filters);

      expect(result).toEqual(expectedTasks);
      expect(repository.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return sorted tasks', async () => {
      const filters: TaskFilterDto = {
        sortBy: 'due_date',
        sortOrder: 'ASC',
      };
      const expectedTasks = [mockTask];

      mockTaskRepository.findAll.mockResolvedValue(expectedTasks);

      const result = await service.findAll(filters);

      expect(result).toEqual(expectedTasks);
      expect(repository.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return empty array when no tasks match filters', async () => {
      const filters: TaskFilterDto = { status: TaskStatus.COMPLETED };

      mockTaskRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll(filters);

      expect(result).toEqual([]);
      expect(repository.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      mockTaskRepository.findOne.mockResolvedValue(mockTask);

      const result = await service.findOne('task-uuid-1');

      expect(result).toEqual(mockTask);
      expect(repository.findOne).toHaveBeenCalledWith('task-uuid-1');
      expect(repository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Task with ID non-existent-id not found',
      );
      expect(repository.findOne).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('findByNoteId', () => {
    it('should return all tasks for a specific note', async () => {
      const noteId = 'note-uuid-1';
      const expectedTasks = [mockTask, { ...mockTask, id: 'task-uuid-2' }];

      mockTaskRepository.findTasksByNoteId.mockResolvedValue(expectedTasks);

      const result = await service.findByNoteId(noteId);

      expect(result).toEqual(expectedTasks);
      expect(repository.findTasksByNoteId).toHaveBeenCalledWith(noteId);
      expect(repository.findTasksByNoteId).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when note has no tasks', async () => {
      const noteId = 'note-uuid-empty';

      mockTaskRepository.findTasksByNoteId.mockResolvedValue([]);

      const result = await service.findByNoteId(noteId);

      expect(result).toEqual([]);
      expect(repository.findTasksByNoteId).toHaveBeenCalledWith(noteId);
    });
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const createTaskDto: CreateTaskDto = {
        note_id: 'note-uuid-1',
        title: 'New Task',
        description: 'New Description',
        priority: TaskPriority.HIGH,
        due_date: '2024-12-31T23:59:59Z',
      };

      const createdTask = { ...mockTask, ...createTaskDto };
      mockTaskRepository.create.mockResolvedValue(createdTask);

      const result = await service.create(createTaskDto);

      expect(result).toEqual(createdTask);
      expect(repository.create).toHaveBeenCalledWith(createTaskDto);
      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it('should create a task with default values', async () => {
      const createTaskDto: CreateTaskDto = {
        note_id: 'note-uuid-1',
        title: 'Minimal Task',
      };

      const createdTask = {
        ...mockTask,
        title: 'Minimal Task',
        status: 'pending',
        priority: 'medium',
      };
      mockTaskRepository.create.mockResolvedValue(createdTask);

      const result = await service.create(createTaskDto);

      expect(result).toEqual(createdTask);
      expect(repository.create).toHaveBeenCalledWith(createTaskDto);
    });

    it('should create a task with metadata', async () => {
      const createTaskDto: CreateTaskDto = {
        note_id: 'note-uuid-1',
        title: 'Task with Metadata',
        metadata: { category: 'important', tags: ['urgent', 'review'] },
      };

      const createdTask = { ...mockTask, ...createTaskDto };
      mockTaskRepository.create.mockResolvedValue(createdTask);

      const result = await service.create(createTaskDto);

      expect(result).toEqual(createdTask);
      expect(repository.create).toHaveBeenCalledWith(createTaskDto);
    });
  });

  describe('update', () => {
    it('should update task properties', async () => {
      const updateTaskDto: UpdateTaskDto = {
        title: 'Updated Title',
        priority: TaskPriority.URGENT,
      };

      const updatedTask = { ...mockTask, ...updateTaskDto };
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockTaskRepository.update.mockResolvedValue(updatedTask);

      const result = await service.update('task-uuid-1', updateTaskDto);

      expect(result).toEqual(updatedTask);
      expect(repository.update).toHaveBeenCalledWith(
        'task-uuid-1',
        updateTaskDto,
      );
    });

    it('should perform partial update', async () => {
      const updateTaskDto: UpdateTaskDto = {
        description: 'Only update description',
      };

      const updatedTask = {
        ...mockTask,
        description: 'Only update description',
      };
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockTaskRepository.update.mockResolvedValue(updatedTask);

      const result = await service.update('task-uuid-1', updateTaskDto);

      expect(result).toEqual(updatedTask);
      expect(repository.update).toHaveBeenCalledWith(
        'task-uuid-1',
        updateTaskDto,
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      const updateTaskDto: UpdateTaskDto = { title: 'Updated' };

      mockTaskRepository.update.mockRejectedValue(
        new Error('Task with ID non-existent-id not found'),
      );

      await expect(
        service.update('non-existent-id', updateTaskDto),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).toHaveBeenCalledWith(
        'non-existent-id',
        updateTaskDto,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update task status to completed and set completed_at', async () => {
      const updateStatusDto: UpdateTaskStatusDto = {
        status: TaskStatus.COMPLETED,
      };

      const completedTask = {
        ...mockTask,
        status: 'completed',
        completed_at: new Date(),
      };
      mockTaskRepository.updateTaskStatus.mockResolvedValue(completedTask);

      const result = await service.updateStatus('task-uuid-1', updateStatusDto);

      expect(result).toEqual(completedTask);
      expect(result.completed_at).not.toBeNull();
      expect(repository.updateTaskStatus).toHaveBeenCalledWith(
        'task-uuid-1',
        'completed',
      );
    });

    it('should update status to in_progress', async () => {
      const updateStatusDto: UpdateTaskStatusDto = {
        status: TaskStatus.IN_PROGRESS,
      };

      const inProgressTask = {
        ...mockTask,
        status: 'in_progress',
        completed_at: null,
      };
      mockTaskRepository.updateTaskStatus.mockResolvedValue(inProgressTask);

      const result = await service.updateStatus('task-uuid-1', updateStatusDto);

      expect(result).toEqual(inProgressTask);
      expect(result.completed_at).toBeNull();
      expect(repository.updateTaskStatus).toHaveBeenCalledWith(
        'task-uuid-1',
        'in_progress',
      );
    });

    it('should clear completed_at when status changes from completed', async () => {
      const completedTask = {
        ...mockTask,
        status: 'completed',
        completed_at: new Date(),
      };
      const updateStatusDto: UpdateTaskStatusDto = {
        status: TaskStatus.PENDING,
      };

      const pendingTask = {
        ...completedTask,
        status: 'pending',
        completed_at: null,
      };
      mockTaskRepository.updateTaskStatus.mockResolvedValue(pendingTask);

      const result = await service.updateStatus(
        'task-uuid-1',
        updateStatusDto,
      );

      expect(result.completed_at).toBeNull();
      expect(repository.updateTaskStatus).toHaveBeenCalledWith(
        'task-uuid-1',
        'pending',
      );
    });

    it('should update status to cancelled', async () => {
      const updateStatusDto: UpdateTaskStatusDto = {
        status: TaskStatus.CANCELLED,
      };

      const cancelledTask = {
        ...mockTask,
        status: 'cancelled',
        completed_at: null,
      };
      mockTaskRepository.updateTaskStatus.mockResolvedValue(cancelledTask);

      const result = await service.updateStatus('task-uuid-1', updateStatusDto);

      expect(result).toEqual(cancelledTask);
      expect(repository.updateTaskStatus).toHaveBeenCalledWith(
        'task-uuid-1',
        'cancelled',
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      const updateStatusDto: UpdateTaskStatusDto = {
        status: TaskStatus.COMPLETED,
      };

      mockTaskRepository.updateTaskStatus.mockRejectedValue(
        new Error('Task with ID non-existent-id not found'),
      );

      await expect(
        service.updateStatus('non-existent-id', updateStatusDto),
      ).rejects.toThrow(NotFoundException);
      expect(repository.updateTaskStatus).toHaveBeenCalledWith(
        'non-existent-id',
        'completed',
      );
    });
  });

  describe('remove', () => {
    it('should delete a task', async () => {
      mockTaskRepository.delete.mockResolvedValue(undefined);

      await service.remove('task-uuid-1');

      expect(repository.delete).toHaveBeenCalledWith('task-uuid-1');
      expect(repository.delete).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTaskRepository.delete.mockRejectedValue(
        new Error('Task with ID non-existent-id not found'),
      );

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.delete).toHaveBeenCalledWith('non-existent-id');
    });
  });
});
