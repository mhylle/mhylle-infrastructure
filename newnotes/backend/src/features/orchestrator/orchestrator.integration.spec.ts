import { Test, TestingModule } from '@nestjs/testing';
import { RuleBasedRouterService } from './services/rule-based-router.service';
import { LLMIntentClassifierService } from './services/llm-intent-classifier.service';
import { LocalModelService } from '@features/llm-service/services/local-model.service';

describe('Orchestrator Integration', () => {
  let ruleRouter: RuleBasedRouterService;
  let llmClassifier: LLMIntentClassifierService;

  // Mock LocalModelService
  const mockLocalModelService = {
    generateCompletion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleBasedRouterService,
        LLMIntentClassifierService,
        {
          provide: LocalModelService,
          useValue: mockLocalModelService,
        },
      ],
    }).compile();

    ruleRouter = module.get<RuleBasedRouterService>(RuleBasedRouterService);
    llmClassifier = module.get<LLMIntentClassifierService>(
      LLMIntentClassifierService,
    );
  });

  it('should have rule router and LLM classifier available', () => {
    expect(ruleRouter).toBeDefined();
    expect(llmClassifier).toBeDefined();
  });

  describe('end-to-end classification', () => {
    it('should classify clear task creation via rules', () => {
      const result = ruleRouter.route('create task to buy groceries');

      expect(result).toBeDefined();
      expect(result.intent).toBe('task_creation');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should classify information seeking via rules', () => {
      const result = ruleRouter.route('how to finetune an LLM?');

      expect(result).toBeDefined();
      expect(result.intent).toBe('information_seeking');
    });

    it('should return null for ambiguous messages (trigger LLM)', () => {
      const result = ruleRouter.route('hmm interesting point');

      expect(result).toBeNull();
    });
  });

  describe('performance benchmarks', () => {
    it('rule-based routing should complete in <10ms', () => {
      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        ruleRouter.route('create task to test performance');
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(10);
    });
  });
});
