import { Test, TestingModule } from '@nestjs/testing';
import { RuleBasedRouterService } from './rule-based-router.service';

describe('RuleBasedRouterService', () => {
  let service: RuleBasedRouterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleBasedRouterService],
    }).compile();

    service = module.get<RuleBasedRouterService>(RuleBasedRouterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('route', () => {
    it('should classify "create task to buy groceries" as task_creation with high confidence', () => {
      const result = service.route('create task to buy groceries');

      expect(result).toBeDefined();
      expect(result.intent).toBe('task_creation');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should classify "how to finetune an LLM?" as information_seeking', () => {
      const result = service.route('how to finetune an LLM?');

      expect(result).toBeDefined();
      expect(result.intent).toBe('information_seeking');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should classify "thanks!" as conversational', () => {
      const result = service.route('thanks!');

      expect(result).toBeDefined();
      expect(result.intent).toBe('conversational');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should return null for ambiguous messages', () => {
      // This message should not match any keywords or patterns
      const result = service.route('xyzabc qwerty asdfgh');

      expect(result).toBeNull();
    });

    it('should respect negative keywords and priority', () => {
      // "I need to prepare for meeting" should be task_creation
      // "need to" matches task_creation (priority 100)
      // No negative keywords match
      const result1 = service.route('I need to prepare for the meeting');
      expect(result1).toBeDefined();
      expect(result1.intent).toBe('task_creation');

      // "I need to learn how to code" should be information_seeking
      // "need to" would match task_creation BUT
      // "how to" is a negative keyword for task_creation
      // So it falls through to information_seeking (priority 80)
      const result2 = service.route('I need to learn how to code');
      expect(result2).toBeDefined();
      expect(result2.intent).toBe('information_seeking');
    });

    it('should route in under 10ms for simple messages', () => {
      const start = Date.now();
      service.route('create task to buy groceries');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });
});
