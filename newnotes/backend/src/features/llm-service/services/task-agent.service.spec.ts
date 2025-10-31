import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TaskAgentService } from './task-agent.service';
import { LocalModelService } from './local-model.service';
import { AIGenerationResponse } from './ai-provider.interface';

describe('TaskAgentService', () => {
  let service: TaskAgentService;
  let localModelService: LocalModelService;
  let configService: ConfigService;

  const mockLocalModelService = {
    generateCompletion: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => defaultValue),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskAgentService,
        {
          provide: LocalModelService,
          useValue: mockLocalModelService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TaskAgentService>(TaskAgentService);
    localModelService = module.get<LocalModelService>(LocalModelService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractTasksFromNote', () => {
    it('should extract tasks successfully from valid JSON response', async () => {
      const noteContent = 'Buy groceries tomorrow and call mom next week';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'Buy groceries',
              description: '',
              priority: 'medium',
              dueDate: new Date('2025-10-30').toISOString(),
              confidence: 0.9,
            },
            {
              title: 'Call mom',
              description: '',
              priority: 'medium',
              dueDate: new Date('2025-11-05').toISOString(),
              confidence: 0.9,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 500,
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.extractTasksFromNote(noteContent);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toBe('Buy groceries');
      expect(result.tasks[0].confidence).toBe(0.9);
      expect(result.tasks[1].title).toBe('Call mom');
      expect(result.modelUsed).toBe('deepseek-r1:32b');
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle JSON wrapped in extra text', async () => {
      const noteContent = 'Test note';
      const mockResponse: AIGenerationResponse = {
        text: `Here are the tasks:\n${JSON.stringify({
          tasks: [
            {
              title: 'Test task',
              priority: 'high',
              confidence: 0.8,
            },
          ],
        })}\nEnd of tasks`,
        model: 'deepseek-r1:32b',
        tokensUsed: 300,
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.extractTasksFromNote(noteContent);

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe('Test task');
    });

    it('should return empty array for invalid JSON', async () => {
      const noteContent = 'Test note';
      const mockResponse: AIGenerationResponse = {
        text: 'This is not valid JSON',
        model: 'deepseek-r1:32b',
        tokensUsed: 100,
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.extractTasksFromNote(noteContent);

      expect(result.tasks).toHaveLength(0);
    });

    it('should filter out invalid tasks', async () => {
      const noteContent = 'Test note';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'Valid task',
              priority: 'high',
              confidence: 0.9,
            },
            {
              // Invalid: no title
              priority: 'low',
              confidence: 0.5,
            },
            {
              title: 'Another valid task',
              priority: 'medium',
              confidence: 0.7,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 400,
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.extractTasksFromNote(noteContent);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].title).toBe('Valid task');
      expect(result.tasks[1].title).toBe('Another valid task');
    });

    it('should normalize task data', async () => {
      const noteContent = 'Test note';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: '  Whitespace task  ',
              description: '  Extra spaces  ',
              // No priority specified
              // No confidence specified
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 200,
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.extractTasksFromNote(noteContent);

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe('Whitespace task');
      expect(result.tasks[0].description).toBe('Extra spaces');
      expect(result.tasks[0].priority).toBe('medium'); // default
      expect(result.tasks[0].confidence).toBe(0.5); // default
    });

    it('should handle date parsing', async () => {
      const noteContent = 'Test note';
      const validDate = new Date('2025-12-25').toISOString();
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'Task with valid date',
              priority: 'high',
              dueDate: validDate,
              confidence: 0.9,
            },
            {
              title: 'Task with invalid date',
              priority: 'low',
              dueDate: 'not-a-date',
              confidence: 0.8,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 300,
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.extractTasksFromNote(noteContent);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].dueDate).toBeInstanceOf(Date);
      expect(result.tasks[1].dueDate).toBeUndefined();
    });

    it('should throw error when LLM service fails', async () => {
      const noteContent = 'Test note';
      const error = new Error('LLM service unavailable');

      mockLocalModelService.generateCompletion.mockRejectedValue(error);

      await expect(service.extractTasksFromNote(noteContent)).rejects.toThrow(
        'LLM service unavailable',
      );
    });
  });

  describe('extractTasksFromNoteWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const noteContent = 'Test note';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'Test task',
              priority: 'medium',
              confidence: 0.8,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 200,
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.extractTasksFromNoteWithRetry(noteContent);

      expect(result.tasks).toHaveLength(1);
      expect(mockLocalModelService.generateCompletion).toHaveBeenCalledTimes(1);
    });

    it(
      'should retry on failure and eventually succeed',
      async () => {
        const noteContent = 'Test note';
        const mockResponse: AIGenerationResponse = {
          text: JSON.stringify({
            tasks: [
              {
                title: 'Test task',
                priority: 'high',
                confidence: 0.9,
              },
            ],
          }),
          model: 'deepseek-r1:32b',
          tokensUsed: 200,
        };

        mockLocalModelService.generateCompletion
          .mockRejectedValueOnce(new Error('Temporary failure 1'))
          .mockRejectedValueOnce(new Error('Temporary failure 2'))
          .mockResolvedValueOnce(mockResponse);

        const result = await service.extractTasksFromNoteWithRetry(
          noteContent,
          3,
        );

        expect(result.tasks).toHaveLength(1);
        expect(mockLocalModelService.generateCompletion).toHaveBeenCalledTimes(
          3,
        );
      },
      10000,
    );

    it(
      'should throw error after max retries exceeded',
      async () => {
        const noteContent = 'Test note';
        const error = new Error('Persistent failure');

        mockLocalModelService.generateCompletion.mockRejectedValue(error);

        await expect(
          service.extractTasksFromNoteWithRetry(noteContent, 2),
        ).rejects.toThrow('Persistent failure');

        expect(mockLocalModelService.generateCompletion).toHaveBeenCalledTimes(
          2,
        );
      },
      10000,
    );

    it(
      'should use default retry count when not specified',
      async () => {
        const noteContent = 'Test note';
        const error = new Error('Failure');

        mockLocalModelService.generateCompletion.mockRejectedValue(error);

        await expect(
          service.extractTasksFromNoteWithRetry(noteContent),
        ).rejects.toThrow();

        expect(mockLocalModelService.generateCompletion).toHaveBeenCalledTimes(
          3,
        );
      },
      15000,
    );
  });

  describe('confidence filtering', () => {
    it('should include tasks with valid confidence scores', async () => {
      const noteContent = 'Test note';
      const mockResponse: AIGenerationResponse = {
        text: JSON.stringify({
          tasks: [
            {
              title: 'High confidence task',
              priority: 'high',
              confidence: 0.95,
            },
            {
              title: 'Low confidence task',
              priority: 'low',
              confidence: 0.2,
            },
            {
              title: 'Medium confidence task',
              priority: 'medium',
              confidence: 0.6,
            },
          ],
        }),
        model: 'deepseek-r1:32b',
        tokensUsed: 400,
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.extractTasksFromNote(noteContent);

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].confidence).toBe(0.95);
      expect(result.tasks[1].confidence).toBe(0.2);
      expect(result.tasks[2].confidence).toBe(0.6);
    });
  });
});
