import { Test, TestingModule } from '@nestjs/testing';
import { LLMIntentClassifierService } from './llm-intent-classifier.service';
import { LLMModule } from '@features/llm-service/llm.module';
import { RedisModule } from '@core/redis/redis.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '@shared/entities/task.entity';
import {
  describeIfOllama,
  LLM_TEST_TIMEOUT,
  validateLLMResponse,
} from '@test/helpers/llm-test-helper';
import { IntentType } from '../types/intent.types';

describeIfOllama('LLMIntentClassifierService Integration', () => {
  let service: LLMIntentClassifierService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'testuser',
          password: process.env.DB_PASSWORD || 'testpass',
          database: process.env.DB_DATABASE || 'testdb',
          entities: [Task],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Task]),
        RedisModule,
        LLMModule,
      ],
      providers: [LLMIntentClassifierService],
    }).compile();

    service = module.get<LLMIntentClassifierService>(LLMIntentClassifierService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Task Creation Intent', () => {
    it(
      'should classify explicit task creation with high confidence',
      async () => {
        const result = await service.classify('Create task to buy groceries', {
          recentMessages: [],
        });

        // Validate structure
        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();
        expect(result.confidence).toBeDefined();

        // Accept task_creation or task_query as valid responses
        const validIntents: IntentType[] = ['task_creation', 'task_query'];
        expect(validIntents).toContain(result.intent);

        // Confidence should be reasonably high for clear task request
        expect(result.confidence).toBeGreaterThan(0.6);
        expect(result.confidence).toBeLessThanOrEqual(1.0);

        // Should not require clarification for explicit task
        expect(result.requires_clarification).toBe(false);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should classify implicit task creation',
      async () => {
        const result = await service.classify(
          'I need to prepare for the meeting tomorrow',
          { recentMessages: [] },
        );

        expect(result).toBeDefined();
        const validIntents: IntentType[] = ['task_creation', 'task_query'];
        expect(validIntents).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.5);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should classify reminder-style task creation',
      async () => {
        const result = await service.classify(
          'Remind me to call mom next week',
          { recentMessages: [] },
        );

        expect(result).toBeDefined();
        const validIntents: IntentType[] = ['task_creation', 'task_query'];
        expect(validIntents).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.6);
      },
      LLM_TEST_TIMEOUT,
    );
  });

  describe('Information Seeking Intent', () => {
    it(
      'should classify technical information seeking',
      async () => {
        const result = await service.classify('How to finetune an LLM?', {
          recentMessages: [],
        });

        expect(result).toBeDefined();

        // Should be information_seeking or analytical
        const validIntents: IntentType[] = ['information_seeking', 'analytical'];
        expect(validIntents).toContain(result.intent);

        // Confidence should be high for clear question
        expect(result.confidence).toBeGreaterThan(0.6);
        expect(result.confidence).toBeLessThanOrEqual(1.0);

        // Technical questions might require clarification
        if (result.requires_clarification) {
          expect(result.clarification_questions).toBeDefined();
          expect(Array.isArray(result.clarification_questions)).toBe(true);
        }
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should classify note-specific information seeking',
      async () => {
        const result = await service.classify('Show me my notes about AI', {
          recentMessages: [],
        });

        expect(result).toBeDefined();

        // Could be information_seeking or analytical (both are reasonable)
        const validIntents: IntentType[] = [
          'information_seeking',
          'analytical',
          'task_query',
        ];
        expect(validIntents).toContain(result.intent);

        // Should have high confidence for clear query
        expect(result.confidence).toBeGreaterThan(0.6);

        // Might suggest notes as search scope
        if (result.suggested_search_scope) {
          expect(['notes', 'both']).toContain(result.suggested_search_scope);
        }
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should classify web information seeking',
      async () => {
        const result = await service.classify(
          'What is the latest news about AI regulation?',
          { recentMessages: [] },
        );

        expect(result).toBeDefined();
        expect(['information_seeking', 'analytical']).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.6);

        // Should suggest web or both for current events
        if (result.suggested_search_scope) {
          expect(['web', 'both']).toContain(result.suggested_search_scope);
        }
      },
      LLM_TEST_TIMEOUT,
    );
  });

  describe('Conversational Intent', () => {
    it(
      'should classify greetings as conversational',
      async () => {
        const result = await service.classify('Hi there!', {
          recentMessages: [],
        });

        expect(result).toBeDefined();
        expect(result.intent).toBe('conversational');
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.requires_clarification).toBe(false);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should classify acknowledgments as conversational',
      async () => {
        const result = await service.classify('Thanks!', {
          recentMessages: [],
        });

        expect(result).toBeDefined();
        expect(result.intent).toBe('conversational');
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.requires_clarification).toBe(false);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should classify small talk as conversational',
      async () => {
        const result = await service.classify('How are you doing today?', {
          recentMessages: [],
        });

        expect(result).toBeDefined();
        expect(result.intent).toBe('conversational');
        expect(result.confidence).toBeGreaterThan(0.6);
      },
      LLM_TEST_TIMEOUT,
    );
  });

  describe('Analytical Intent', () => {
    it(
      'should classify data aggregation requests',
      async () => {
        const result = await service.classify(
          'Summarize all my machine learning notes',
          { recentMessages: [] },
        );

        expect(result).toBeDefined();

        // Should be analytical or information_seeking
        const validIntents: IntentType[] = ['analytical', 'information_seeking'];
        expect(validIntents).toContain(result.intent);

        expect(result.confidence).toBeGreaterThan(0.6);
        expect(['notes', 'both']).toContain(
          result.suggested_search_scope || 'notes',
        );
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should classify analysis requests',
      async () => {
        const result = await service.classify(
          'Compare my productivity across different projects',
          { recentMessages: [] },
        );

        expect(result).toBeDefined();
        const validIntents: IntentType[] = ['analytical', 'task_query'];
        expect(validIntents).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.6);
      },
      LLM_TEST_TIMEOUT,
    );
  });

  describe('Task Query Intent', () => {
    it(
      'should classify task listing requests',
      async () => {
        const result = await service.classify('Show me my tasks for today', {
          recentMessages: [],
        });

        expect(result).toBeDefined();
        const validIntents: IntentType[] = ['task_query', 'analytical'];
        expect(validIntents).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.6);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should classify task status queries',
      async () => {
        const result = await service.classify(
          'What tasks are pending?',
          { recentMessages: [] },
        );

        expect(result).toBeDefined();
        const validIntents: IntentType[] = ['task_query', 'analytical'];
        expect(validIntents).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.6);
      },
      LLM_TEST_TIMEOUT,
    );
  });

  describe('Ambiguous Messages', () => {
    it(
      'should handle ambiguous messages with clarification',
      async () => {
        const result = await service.classify('machine learning', {
          recentMessages: [],
        });

        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0.0);

        // Ambiguous messages might require clarification
        if (result.requires_clarification) {
          expect(result.clarification_questions).toBeDefined();
          expect(result.clarification_questions.length).toBeGreaterThan(0);
        }
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should handle single word messages',
      async () => {
        const result = await service.classify('tasks', {
          recentMessages: [],
        });

        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();

        // Single word is likely ambiguous
        const validIntents: IntentType[] = [
          'task_query',
          'information_seeking',
          'conversational',
        ];
        expect(validIntents).toContain(result.intent);

        // May have lower confidence or require clarification
        if (result.confidence < 0.7) {
          expect(result.requires_clarification).toBe(true);
        }
      },
      LLM_TEST_TIMEOUT,
    );
  });

  describe('Context-Aware Classification', () => {
    it(
      'should use conversation context for classification',
      async () => {
        const context = {
          recentMessages: [
            { role: 'user', content: 'I need to buy groceries' },
            {
              role: 'assistant',
              content: 'Would you like me to create a task for that?',
            },
            { role: 'user', content: 'yes please' },
          ],
        };

        const result = await service.classify('yes please', context);

        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();

        // With context, "yes please" should be task_creation or conversational
        const validIntents: IntentType[] = ['task_creation', 'conversational'];
        expect(validIntents).toContain(result.intent);

        expect(result.confidence).toBeGreaterThan(0.5);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should handle follow-up questions with context',
      async () => {
        const context = {
          recentMessages: [
            { role: 'user', content: 'Tell me about neural networks' },
            {
              role: 'assistant',
              content: 'Neural networks are machine learning models...',
            },
          ],
        };

        const result = await service.classify('What about transformers?', context);

        expect(result).toBeDefined();
        expect(['information_seeking', 'analytical']).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.6);
      },
      LLM_TEST_TIMEOUT,
    );
  });

  describe('Edge Cases', () => {
    it(
      'should handle empty message gracefully',
      async () => {
        const result = await service.classify('', { recentMessages: [] });

        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();

        // Empty message should be conversational with low confidence
        expect(result.intent).toBe('conversational');
        expect(result.confidence).toBeLessThan(0.5);
        expect(result.requires_clarification).toBe(true);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should handle very long messages',
      async () => {
        const longMessage = 'I want to create a task for ' + 'very '.repeat(100) + 'important meeting';
        const result = await service.classify(longMessage, {
          recentMessages: [],
        });

        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();

        const validIntents: IntentType[] = ['task_creation', 'task_query'];
        expect(validIntents).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.5);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should handle messages with special characters',
      async () => {
        const result = await service.classify(
          'Create task: Buy milk @ store #groceries',
          { recentMessages: [] },
        );

        expect(result).toBeDefined();
        const validIntents: IntentType[] = ['task_creation', 'task_query'];
        expect(validIntents).toContain(result.intent);
        expect(result.confidence).toBeGreaterThan(0.6);
      },
      LLM_TEST_TIMEOUT,
    );
  });

  describe('Response Validation', () => {
    it(
      'should always return valid confidence score',
      async () => {
        const result = await service.classify('test message', {
          recentMessages: [],
        });

        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
        expect(typeof result.confidence).toBe('number');
        expect(isNaN(result.confidence)).toBe(false);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should always return valid intent type',
      async () => {
        const result = await service.classify('another test', {
          recentMessages: [],
        });

        const validIntents: IntentType[] = [
          'task_creation',
          'task_query',
          'information_seeking',
          'analytical',
          'conversational',
        ];

        expect(validIntents).toContain(result.intent);
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should provide reasoning when available',
      async () => {
        const result = await service.classify('Create a task to review code', {
          recentMessages: [],
        });

        // Reasoning is optional but helpful
        if (result.reasoning) {
          expect(typeof result.reasoning).toBe('string');
          expect(result.reasoning.length).toBeGreaterThan(0);
        }
      },
      LLM_TEST_TIMEOUT,
    );

    it(
      'should provide clarification questions when needed',
      async () => {
        const result = await service.classify('AI stuff', {
          recentMessages: [],
        });

        if (result.requires_clarification) {
          expect(result.clarification_questions).toBeDefined();
          expect(Array.isArray(result.clarification_questions)).toBe(true);

          if (result.clarification_questions.length > 0) {
            result.clarification_questions.forEach((question) => {
              expect(typeof question).toBe('string');
              expect(question.length).toBeGreaterThan(0);
            });
          }
        }
      },
      LLM_TEST_TIMEOUT,
    );
  });
});
