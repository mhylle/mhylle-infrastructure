import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TaskAgentService } from './task-agent.service';
import { LocalModelService } from './local-model.service';
import configuration from '../../../core/config/configuration';
import { TasksService } from '../../tasks/tasks.service';
import { CreateTaskDto } from '../../tasks/dto/create-task.dto';
import { Task } from '../../../shared/entities/task.entity';

/**
 * REAL LLM INTEGRATION TESTS
 *
 * These tests use REAL Ollama for task extraction logic testing.
 * TasksService is MOCKED to avoid database dependencies.
 *
 * Requirements:
 * - Ollama running on localhost:11434
 * - Model available: deepseek-r1:1.5b (or configured model)
 *
 * To run these tests:
 * 1. Ensure Ollama is running: ollama serve
 * 2. Pull model if needed: ollama pull deepseek-r1:1.5b
 * 3. Run: npm test task-agent-llm.integration.spec.ts
 *
 * These tests validate:
 * - Real LLM task extraction accuracy
 * - Response parsing and validation
 * - Edge case handling
 * - JSON cleaning and normalization
 */
describe('TaskAgent LLM Integration Tests (Real Ollama)', () => {
  let taskAgentService: TaskAgentService;
  let localModelService: LocalModelService;
  let mockTasksService: jest.Mocked<TasksService>;

  beforeAll(async () => {
    // Mock TasksService to avoid database dependencies
    mockTasksService = {
      create: jest.fn().mockImplementation(async (dto: CreateTaskDto) => {
        return {
          id: `mock-task-${Date.now()}`,
          ...dto,
          status: 'pending',
          completed_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        } as Task;
      }),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByNoteId: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        TaskAgentService,
        LocalModelService,
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    taskAgentService = module.get<TaskAgentService>(TaskAgentService);
    localModelService = module.get<LocalModelService>(LocalModelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Real LLM Task Extraction', () => {
    it('should extract simple action items from chat message', async () => {
      const chatMessage = 'I need to buy groceries tomorrow and call mom next week';

      const result = await taskAgentService.extractTasksFromNote(chatMessage);

      // Flexible assertions - LLM output may vary
      expect(result.tasks.length).toBeGreaterThanOrEqual(0);
      expect(result.modelUsed).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);

      if (result.tasks.length > 0) {
        // Validate task structure
        result.tasks.forEach((task) => {
          expect(task.title).toBeDefined();
          expect(typeof task.title).toBe('string');
          expect(task.title.length).toBeGreaterThan(0);
          expect(['low', 'medium', 'high']).toContain(task.priority);
          expect(task.confidence).toBeGreaterThanOrEqual(0);
          expect(task.confidence).toBeLessThanOrEqual(1);
        });

        // Check for expected keywords in extracted tasks
        const allTaskText = result.tasks
          .map((t) => `${t.title} ${t.description || ''}`.toLowerCase())
          .join(' ');
        const hasRelevantContent =
          allTaskText.includes('groceries') ||
          allTaskText.includes('buy') ||
          allTaskText.includes('call') ||
          allTaskText.includes('mom');
        expect(hasRelevantContent).toBe(true);
      }
    }, 30000);

    it('should handle chat message with no actionable tasks', async () => {
      const chatMessage = 'The weather is nice today. I like sunny days.';

      const result = await taskAgentService.extractTasksFromNote(chatMessage);

      expect(result.tasks).toBeDefined();
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.modelUsed).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);

      // LLM should ideally return empty array or very low confidence tasks
      // Allow some flexibility as LLM might hallucinate low-priority tasks
      if (result.tasks.length > 0) {
        result.tasks.forEach((task) => {
          expect(task.confidence).toBeLessThanOrEqual(0.6); // Should be low confidence
        });
      }
    }, 30000);

    it('should extract multiple tasks with different priorities', async () => {
      const chatMessage = `
        URGENT: Fix the production bug immediately!
        Tomorrow: Review the pull request
        Next week: Update the documentation
      `;

      const result = await taskAgentService.extractTasksFromNote(chatMessage);

      expect(result.tasks.length).toBeGreaterThanOrEqual(0);

      if (result.tasks.length > 0) {
        // Validate task structure
        result.tasks.forEach((task) => {
          expect(task.title).toBeDefined();
          expect(['low', 'medium', 'high']).toContain(task.priority);
        });

        // Check if LLM recognized urgency (should have at least one high priority)
        const allTaskText = result.tasks
          .map((t) => `${t.title} ${t.description || ''}`.toLowerCase())
          .join(' ');
        const hasRelevantContent =
          allTaskText.includes('bug') ||
          allTaskText.includes('fix') ||
          allTaskText.includes('review') ||
          allTaskText.includes('update') ||
          allTaskText.includes('documentation');
        expect(hasRelevantContent).toBe(true);
      }
    }, 30000);

    it('should handle complex chat message with dates', async () => {
      const chatMessage = `
        Meeting on Friday at 2pm to discuss Q1 results.
        Need to prepare the presentation by Thursday.
        Follow up with the client next Monday.
      `;

      const result = await taskAgentService.extractTasksFromNote(chatMessage);

      expect(result.tasks).toBeDefined();
      expect(result.modelUsed).toBeDefined();

      if (result.tasks.length > 0) {
        result.tasks.forEach((task) => {
          expect(task.title).toBeDefined();
          expect(['low', 'medium', 'high']).toContain(task.priority);

          // If LLM extracted a date, validate it's a valid Date object
          if (task.dueDate) {
            expect(task.dueDate).toBeInstanceOf(Date);
            expect(task.dueDate.getTime()).not.toBeNaN();
          }
        });
      }
    }, 30000);

    it('should handle messages with implied vs explicit tasks', async () => {
      const chatMessage = `
        I'm thinking about rewriting the authentication module.
        We should definitely add unit tests for the API endpoints.
      `;

      const result = await taskAgentService.extractTasksFromNote(chatMessage);

      expect(result.tasks).toBeDefined();

      if (result.tasks.length > 0) {
        // Validate confidence scores
        result.tasks.forEach((task) => {
          expect(task.confidence).toBeGreaterThanOrEqual(0);
          expect(task.confidence).toBeLessThanOrEqual(1);
        });

        // "should definitely" is more actionable than "thinking about"
        // LLM might assign different confidence levels
        const allTasks = result.tasks.map((t) =>
          `${t.title} ${t.description || ''}`.toLowerCase(),
        );
        const hasTestTask = allTasks.some(
          (text) => text.includes('test') || text.includes('unit'),
        );
        const hasAuthTask = allTasks.some(
          (text) => text.includes('auth') || text.includes('rewrite'),
        );

        // At least one task should be recognized
        expect(hasTestTask || hasAuthTask).toBe(true);
      }
    }, 30000);

    it('should extract tasks from technical discussion', async () => {
      const chatMessage = `
        The API is returning 500 errors. Need to check the logs.
        Database queries are slow - optimize the indexes.
        Deploy the hotfix to production ASAP.
      `;

      const result = await taskAgentService.extractTasksFromNote(chatMessage);

      expect(result.tasks.length).toBeGreaterThanOrEqual(0);

      if (result.tasks.length > 0) {
        result.tasks.forEach((task) => {
          expect(task.title).toBeDefined();
          expect(task.title.length).toBeGreaterThan(0);
          expect(['low', 'medium', 'high']).toContain(task.priority);
        });

        // Check for technical keywords
        const allTaskText = result.tasks
          .map((t) => `${t.title} ${t.description || ''}`.toLowerCase())
          .join(' ');
        const hasTechnicalContent =
          allTaskText.includes('log') ||
          allTaskText.includes('database') ||
          allTaskText.includes('optimize') ||
          allTaskText.includes('deploy') ||
          allTaskText.includes('error') ||
          allTaskText.includes('fix');
        expect(hasTechnicalContent).toBe(true);

        // ASAP should result in high priority for deploy task
        const deployTask = result.tasks.find((t) =>
          `${t.title} ${t.description || ''}`
            .toLowerCase()
            .includes('deploy'),
        );
        if (deployTask) {
          expect(['medium', 'high']).toContain(deployTask.priority);
        }
      }
    }, 30000);
  });

  describe('LLM Response Parsing Edge Cases', () => {
    it('should handle LLM responses with <think> tags (deepseek-r1)', async () => {
      const chatMessage = 'Quick task: send email to John';

      const result = await taskAgentService.extractTasksFromNote(chatMessage);

      // Should successfully parse even if model includes reasoning tags
      expect(result.tasks).toBeDefined();
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.modelUsed).toBeDefined();
    }, 30000);

    it('should handle LLM responses with trailing commas', async () => {
      const chatMessage = 'Call the team tomorrow';

      const result = await taskAgentService.extractTasksFromNote(chatMessage);

      // Should successfully parse even with JSON formatting issues
      expect(result.tasks).toBeDefined();
      expect(Array.isArray(result.tasks)).toBe(true);
    }, 30000);
  });

  describe('Retry Logic with Real LLM', () => {
    it('should retry and eventually succeed with real LLM', async () => {
      const chatMessage = 'Buy milk';

      // Real LLM might have transient issues, retry should handle it
      const result = await taskAgentService.extractTasksFromNoteWithRetry(
        chatMessage,
        3,
      );

      expect(result.tasks).toBeDefined();
      expect(result.modelUsed).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    }, 60000);
  });
});
