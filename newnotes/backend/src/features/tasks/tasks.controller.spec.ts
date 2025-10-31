import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, UpdateTaskStatusDto, TaskFilterDto, TaskStatus, TaskPriority } from './dto';
import { NotFoundException } from '@nestjs/common';

describe('TasksController', () => {
  let controller: TasksController;
  let service: TasksService;

  const mockTask = {
    id: 'task-uuid-1',
    note_id: 'note-uuid-1',
    title: 'Test Task',
    description: 'Task description',
    status: 'pending',
    priority: 'medium',
    due_date: new Date('2024-12-31'),
    completed_at: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    llm_confidence: 0.9,
    metadata: { source: 'manual' },
  };

  const mockTasksService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByNoteId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/notes/tasks', () => {
    it('should return all tasks without filters', async () => {
      const filters: TaskFilterDto = {};
      mockTasksService.findAll.mockResolvedValue([mockTask]);

      const result = await controller.findAll(filters);

      expect(result).toEqual([mockTask]);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return tasks filtered by noteId', async () => {
      const filters: TaskFilterDto = { noteId: 'note-uuid-1' };
      mockTasksService.findAll.mockResolvedValue([mockTask]);

      const result = await controller.findAll(filters);

      expect(result).toEqual([mockTask]);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return tasks filtered by status', async () => {
      const filters: TaskFilterDto = { status: TaskStatus.PENDING };
      mockTasksService.findAll.mockResolvedValue([mockTask]);

      const result = await controller.findAll(filters);

      expect(result).toEqual([mockTask]);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return tasks filtered by priority', async () => {
      const filters: TaskFilterDto = { priority: TaskPriority.HIGH };
      const highPriorityTask = { ...mockTask, priority: 'high' };
      mockTasksService.findAll.mockResolvedValue([highPriorityTask]);

      const result = await controller.findAll(filters);

      expect(result).toEqual([highPriorityTask]);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return tasks filtered by date range', async () => {
      const filters: TaskFilterDto = {
        dueDateFrom: '2024-01-01',
        dueDateTo: '2024-12-31',
      };
      mockTasksService.findAll.mockResolvedValue([mockTask]);

      const result = await controller.findAll(filters);

      expect(result).toEqual([mockTask]);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return sorted tasks', async () => {
      const filters: TaskFilterDto = {
        sortBy: 'due_date',
        sortOrder: 'ASC',
      };
      mockTasksService.findAll.mockResolvedValue([mockTask]);

      const result = await controller.findAll(filters);

      expect(result).toEqual([mockTask]);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should return empty array when no tasks match', async () => {
      const filters: TaskFilterDto = { status: TaskStatus.COMPLETED };
      mockTasksService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(filters);

      expect(result).toEqual([]);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('GET /api/notes/tasks/:id', () => {
    it('should return a task by id', async () => {
      mockTasksService.findOne.mockResolvedValue(mockTask);

      const result = await controller.findOne('task-uuid-1');

      expect(result).toEqual(mockTask);
      expect(service.findOne).toHaveBeenCalledWith('task-uuid-1');
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTasksService.findOne.mockRejectedValue(
        new NotFoundException('Task with ID non-existent-id not found'),
      );

      await expect(controller.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(service.findOne).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('GET /api/notes/tasks/note/:noteId', () => {
    it('should return all tasks for a specific note', async () => {
      const tasks = [mockTask, { ...mockTask, id: 'task-uuid-2' }];
      mockTasksService.findByNoteId.mockResolvedValue(tasks);

      const result = await controller.findByNoteId('note-uuid-1');

      expect(result).toEqual(tasks);
      expect(service.findByNoteId).toHaveBeenCalledWith('note-uuid-1');
    });

    it('should return empty array when note has no tasks', async () => {
      mockTasksService.findByNoteId.mockResolvedValue([]);

      const result = await controller.findByNoteId('note-uuid-1');

      expect(result).toEqual([]);
      expect(service.findByNoteId).toHaveBeenCalledWith('note-uuid-1');
    });
  });

  describe('POST /api/notes/tasks', () => {
    it('should create a new task', async () => {
      const createDto: CreateTaskDto = {
        note_id: 'note-uuid-1',
        title: 'New Task',
        description: 'Task description',
        priority: TaskPriority.HIGH,
      };
      const newTask = { ...mockTask, ...createDto, id: 'new-task-uuid' };
      mockTasksService.create.mockResolvedValue(newTask);

      const result = await controller.create(createDto);

      expect(result).toEqual(newTask);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should create a task with minimal data', async () => {
      const createDto: CreateTaskDto = {
        note_id: 'note-uuid-1',
        title: 'Minimal Task',
      };
      const newTask = {
        ...mockTask,
        ...createDto,
        id: 'minimal-task-uuid',
        status: 'pending',
        priority: 'medium',
      };
      mockTasksService.create.mockResolvedValue(newTask);

      const result = await controller.create(createDto);

      expect(result).toEqual(newTask);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should create a task with metadata', async () => {
      const createDto: CreateTaskDto = {
        note_id: 'note-uuid-1',
        title: 'Task with Metadata',
        metadata: { tags: ['urgent', 'backend'], source: 'llm' },
      };
      const newTask = { ...mockTask, ...createDto, id: 'metadata-task-uuid' };
      mockTasksService.create.mockResolvedValue(newTask);

      const result = await controller.create(createDto);

      expect(result).toEqual(newTask);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('PATCH /api/notes/tasks/:id', () => {
    it('should update task properties', async () => {
      const updateDto: UpdateTaskDto = {
        title: 'Updated Task',
        priority: TaskPriority.URGENT,
      };
      const updatedTask = { ...mockTask, ...updateDto };
      mockTasksService.update.mockResolvedValue(updatedTask);

      const result = await controller.update('task-uuid-1', updateDto);

      expect(result).toEqual(updatedTask);
      expect(service.update).toHaveBeenCalledWith('task-uuid-1', updateDto);
    });

    it('should perform partial update', async () => {
      const updateDto: UpdateTaskDto = { title: 'Updated Title Only' };
      const updatedTask = { ...mockTask, title: 'Updated Title Only' };
      mockTasksService.update.mockResolvedValue(updatedTask);

      const result = await controller.update('task-uuid-1', updateDto);

      expect(result).toEqual(updatedTask);
      expect(service.update).toHaveBeenCalledWith('task-uuid-1', updateDto);
    });

    it('should throw NotFoundException when task not found', async () => {
      const updateDto: UpdateTaskDto = { title: 'Updated Task' };
      mockTasksService.update.mockRejectedValue(
        new NotFoundException('Task with ID non-existent-id not found'),
      );

      await expect(
        controller.update('non-existent-id', updateDto),
      ).rejects.toThrow(NotFoundException);
      expect(service.update).toHaveBeenCalledWith('non-existent-id', updateDto);
    });
  });

  describe('PATCH /api/notes/tasks/:id/status', () => {
    it('should update task status to completed', async () => {
      const statusDto: UpdateTaskStatusDto = { status: TaskStatus.COMPLETED };
      const completedTask = {
        ...mockTask,
        status: 'completed',
        completed_at: new Date(),
      };
      mockTasksService.updateStatus.mockResolvedValue(completedTask);

      const result = await controller.updateStatus('task-uuid-1', statusDto);

      expect(result).toEqual(completedTask);
      expect(service.updateStatus).toHaveBeenCalledWith(
        'task-uuid-1',
        statusDto,
      );
    });

    it('should update status to in_progress', async () => {
      const statusDto: UpdateTaskStatusDto = { status: TaskStatus.IN_PROGRESS };
      const inProgressTask = { ...mockTask, status: 'in_progress' };
      mockTasksService.updateStatus.mockResolvedValue(inProgressTask);

      const result = await controller.updateStatus('task-uuid-1', statusDto);

      expect(result).toEqual(inProgressTask);
      expect(service.updateStatus).toHaveBeenCalledWith(
        'task-uuid-1',
        statusDto,
      );
    });

    it('should clear completed_at when status changes from completed', async () => {
      const statusDto: UpdateTaskStatusDto = { status: TaskStatus.PENDING };
      const resetTask = {
        ...mockTask,
        status: 'pending',
        completed_at: null,
      };
      mockTasksService.updateStatus.mockResolvedValue(resetTask);

      const result = await controller.updateStatus('task-uuid-1', statusDto);

      expect(result).toEqual(resetTask);
      expect(result.completed_at).toBeNull();
      expect(service.updateStatus).toHaveBeenCalledWith(
        'task-uuid-1',
        statusDto,
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      const statusDto: UpdateTaskStatusDto = { status: TaskStatus.COMPLETED };
      mockTasksService.updateStatus.mockRejectedValue(
        new NotFoundException('Task with ID non-existent-id not found'),
      );

      await expect(
        controller.updateStatus('non-existent-id', statusDto),
      ).rejects.toThrow(NotFoundException);
      expect(service.updateStatus).toHaveBeenCalledWith(
        'non-existent-id',
        statusDto,
      );
    });
  });

  describe('DELETE /api/notes/tasks/:id', () => {
    it('should delete a task', async () => {
      mockTasksService.remove.mockResolvedValue(undefined);

      await controller.remove('task-uuid-1');

      expect(service.remove).toHaveBeenCalledWith('task-uuid-1');
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTasksService.remove.mockRejectedValue(
        new NotFoundException('Task with ID non-existent-id not found'),
      );

      await expect(controller.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(service.remove).toHaveBeenCalledWith('non-existent-id');
    });
  });
});
