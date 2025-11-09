import { Test, TestingModule } from '@nestjs/testing';
import { LLMIntentClassifierService } from './llm-intent-classifier.service';
import { LocalModelService } from '@features/llm-service/services/local-model.service';

describe('LLMIntentClassifierService', () => {
  let service: LLMIntentClassifierService;
  let mockLocalModelService: jest.Mocked<LocalModelService>;

  beforeEach(async () => {
    mockLocalModelService = {
      generateCompletion: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMIntentClassifierService,
        { provide: LocalModelService, useValue: mockLocalModelService },
      ],
    }).compile();

    service = module.get<LLMIntentClassifierService>(LLMIntentClassifierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('classify', () => {
    it('should parse valid JSON response from LLM', async () => {
      const mockResponse = {
        text: JSON.stringify({
          intent: 'task_creation',
          confidence: 0.95,
          reasoning: 'Clear task',
          requires_clarification: false,
          clarification_questions: [],
        }),
        model: 'llama3',
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.classify('create task to buy milk', { recentMessages: [] });

      expect(result).toBeDefined();
      expect(result.intent).toBe('task_creation');
      expect(result.confidence).toBe(0.95);
    });

    it('should handle LLM response with <think> tags', async () => {
      const mockResponse = {
        text: '<think>Let me analyze this...</think>{"intent":"information_seeking","confidence":0.9,"reasoning":"User asking question","requires_clarification":false,"clarification_questions":[]}',
        model: 'deepseek-r1',
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.classify('how to finetune LLM?', { recentMessages: [] });

      expect(result.intent).toBe('information_seeking');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle malformed JSON gracefully', async () => {
      const mockResponse = {
        text: 'This is not JSON',
        model: 'llama3',
      };

      mockLocalModelService.generateCompletion.mockResolvedValue(mockResponse);

      const result = await service.classify('some message', { recentMessages: [] });

      // Should return fallback classification
      expect(result.intent).toBe('conversational');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});
