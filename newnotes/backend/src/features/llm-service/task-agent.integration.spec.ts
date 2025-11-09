import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskAgentService } from './services/task-agent.service';
import { LocalModelService } from './services/local-model.service';
import { TaskRepository } from './repositories/task.repository';
import { Task } from '../../shared/entities/task.entity';
import { Note } from '../../shared/entities/note.entity';
import { AIGenerationResponse } from './services/ai-provider.interface';
import configuration from '../../core/config/configuration';

describe('TaskAgent Integration Tests', () => {
  let taskAgentService: TaskAgentService;
  let taskRepository: TaskRepository;
  let localModelService: LocalModelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test',
          database: 'test_notes',
          entities: [Task, Note],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Task, Note]),
      ],
      providers: [TaskAgentService, LocalModelService, TaskRepository],
    }).compile();

    taskAgentService = module.get<TaskAgentService>(TaskAgentService);
    taskRepository = module.get<TaskRepository>(TaskRepository);
    localModelService = module.get<LocalModelService>(LocalModelService);
  });

  describe('End-to-End Task Extraction Flow', () => {
    it('should extract tasks and save to database', async () => {
      const noteContent = 'Buy groceries tomorrow and call mom next week';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'Buy groceries',
              description: 'Get food items',
              priority: 'high',
              dueDate: new Date('2025-10-30').toISOString(),
              confidence: 0.9,
            },
            {
              title: 'Call mom',
              description: 'Weekly check-in',
              priority: 'medium',
              dueDate: new Date('2025-11-05').toISOString(),
              confidence: 0.85,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 500,
      };

      jest
        .spyOn(localModelService, 'generateCompletion')
        .mockResolvedValue(mockResponse);

      const extractionResult =
        await taskAgentService.extractTasksFromNote(noteContent);

      expect(extractionResult.tasks).toHaveLength(2);
      expect(extractionResult.modelUsed).toBe('deepseek-r1:32b');

      const mockNoteId = '123e4567-e89b-12d3-a456-426614174000';
      const savedTasks = await taskRepository.createTasksForNote(
        mockNoteId,
        extractionResult.tasks,
      );

      expect(savedTasks).toHaveLength(2);
      expect(savedTasks[0].title).toBe('Buy groceries');
      expect(savedTasks[0].priority).toBe('high');
      expect(savedTasks[0].llm_confidence).toBe(0.9);
      expect(savedTasks[0].status).toBe('pending');
    });

    it('should handle note with no tasks', async () => {
      const noteContent = 'This is just a thought. No action items.';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 200,
      };

      jest
        .spyOn(localModelService, 'generateCompletion')
        .mockResolvedValue(mockResponse);

      const extractionResult =
        await taskAgentService.extractTasksFromNote(noteContent);

      expect(extractionResult.tasks).toHaveLength(0);

      const mockNoteId = '123e4567-e89b-12d3-a456-426614174001';
      const savedTasks = await taskRepository.createTasksForNote(
        mockNoteId,
        extractionResult.tasks,
      );

      expect(savedTasks).toHaveLength(0);
    });

    it('should handle complex note with multiple task types', async () => {
      const noteContent = `
        High priority: Fix production bug ASAP
        Medium priority: Review code tomorrow
        Low priority: Update documentation next week
      `;
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'Fix production bug',
              description: 'Critical issue',
              priority: 'high',
              confidence: 0.95,
            },
            {
              title: 'Review code',
              description: 'Code review',
              priority: 'medium',
              dueDate: new Date('2025-10-30').toISOString(),
              confidence: 0.8,
            },
            {
              title: 'Update documentation',
              description: 'Documentation update',
              priority: 'low',
              dueDate: new Date('2025-11-05').toISOString(),
              confidence: 0.7,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 600,
      };

      jest
        .spyOn(localModelService, 'generateCompletion')
        .mockResolvedValue(mockResponse);

      const extractionResult =
        await taskAgentService.extractTasksFromNote(noteContent);

      expect(extractionResult.tasks).toHaveLength(3);

      const mockNoteId = '123e4567-e89b-12d3-a456-426614174002';
      const savedTasks = await taskRepository.createTasksForNote(
        mockNoteId,
        extractionResult.tasks,
      );

      expect(savedTasks).toHaveLength(3);

      const highPriorityTasks = savedTasks.filter((t) => t.priority === 'high');
      expect(highPriorityTasks).toHaveLength(1);

      const retrievedTasks =
        await taskRepository.findTasksByNoteId(mockNoteId);
      expect(retrievedTasks).toHaveLength(3);
    });

    it('should update task status correctly', async () => {
      const noteContent = 'Complete project report';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'Complete project report',
              priority: 'high',
              confidence: 0.9,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 300,
      };

      jest
        .spyOn(localModelService, 'generateCompletion')
        .mockResolvedValue(mockResponse);

      const extractionResult =
        await taskAgentService.extractTasksFromNote(noteContent);

      const mockNoteId = '123e4567-e89b-12d3-a456-426614174003';
      const savedTasks = await taskRepository.createTasksForNote(
        mockNoteId,
        extractionResult.tasks,
      );

      expect(savedTasks[0].status).toBe('pending');
      expect(savedTasks[0].completed_at).toBeNull();

      const updatedTask = await taskRepository.updateTaskStatus(
        savedTasks[0].id,
        'completed',
      );

      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.completed_at).not.toBeNull();
    });

    it('should handle LLM service failure gracefully', async () => {
      const noteContent = 'Test note';

      jest
        .spyOn(localModelService, 'generateCompletion')
        .mockRejectedValue(new Error('LLM service unavailable'));

      await expect(
        taskAgentService.extractTasksFromNote(noteContent),
      ).rejects.toThrow('LLM service unavailable');
    });

    it('should retry on transient failures', async () => {
      const noteContent = 'Buy milk';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'Buy milk',
              priority: 'medium',
              confidence: 0.8,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 200,
      };

      const generateCompletionSpy = jest
        .spyOn(localModelService, 'generateCompletion')
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(mockResponse);

      const extractionResult =
        await taskAgentService.extractTasksFromNoteWithRetry(noteContent, 3);

      expect(extractionResult.tasks).toHaveLength(1);
      expect(generateCompletionSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Task Repository Operations', () => {
    it('should retrieve tasks by note ID in correct order', async () => {
      const mockNoteId = '123e4567-e89b-12d3-a456-426614174004';
      const tasks = [
        {
          title: 'First task',
          priority: 'high' as const,
          confidence: 0.9,
        },
        {
          title: 'Second task',
          priority: 'medium' as const,
          confidence: 0.8,
        },
        {
          title: 'Third task',
          priority: 'low' as const,
          confidence: 0.7,
        },
      ];

      const savedTasks = await taskRepository.createTasksForNote(
        mockNoteId,
        tasks,
      );

      expect(savedTasks).toHaveLength(3);

      const retrievedTasks =
        await taskRepository.findTasksByNoteId(mockNoteId);

      expect(retrievedTasks).toHaveLength(3);
      expect(retrievedTasks[0].created_at.getTime()).toBeGreaterThanOrEqual(
        retrievedTasks[1].created_at.getTime(),
      );
    });

    it('should throw error when updating non-existent task', async () => {
      const fakeTaskId = '123e4567-e89b-12d3-a456-999999999999';

      await expect(
        taskRepository.updateTaskStatus(fakeTaskId, 'completed'),
      ).rejects.toThrow(`Task with ID ${fakeTaskId} not found`);
    });

    it('should reset completed_at when changing from completed status', async () => {
      const mockNoteId = '123e4567-e89b-12d3-a456-426614174005';
      const tasks = [
        {
          title: 'Test task',
          priority: 'medium' as const,
          confidence: 0.8,
        },
      ];

      const savedTasks = await taskRepository.createTasksForNote(
        mockNoteId,
        tasks,
      );

      const completedTask = await taskRepository.updateTaskStatus(
        savedTasks[0].id,
        'completed',
      );
      expect(completedTask.completed_at).not.toBeNull();

      const reopenedTask = await taskRepository.updateTaskStatus(
        savedTasks[0].id,
        'pending',
      );
      expect(reopenedTask.completed_at).toBeNull();
    });
  });
});
