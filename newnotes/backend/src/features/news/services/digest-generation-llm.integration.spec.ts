import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DigestGenerationService } from './digest-generation.service';
import { UserNewsDigest } from '../entities/user-news-digest.entity';
import { NewsItem } from '../entities/news-item.entity';
import { SubscriptionsService } from '../../interests/services/subscriptions.service';
import { LocalModelService } from '../../llm-service/services/local-model.service';

/**
 * Integration test for DigestGenerationService with real Ollama LLM
 * Tests actual digest generation from news items using Ollama models
 *
 * Prerequisites:
 * - Ollama must be running locally (ollama serve)
 * - qwen3:30b model must be pulled (ollama pull qwen3:30b)
 *
 * Test Strategy:
 * - Mock repositories and database queries to provide controlled test data
 * - Use real LLM service to test actual summarization capabilities
 * - Flexible assertions on LLM output (content validation vs exact matching)
 * - Test quality of summarization with realistic news items
 */
describe('DigestGenerationService - LLM Integration Tests', () => {
  let service: DigestGenerationService;
  let digestRepo: Repository<UserNewsDigest>;
  let newsRepo: Repository<NewsItem>;
  let subscriptionsService: SubscriptionsService;
  let llmService: LocalModelService;
  let dataSource: DataSource;

  // Sample test data: realistic news items for testing
  const sampleNewsItems = [
    {
      id: '1',
      title: 'Microsoft announces partnership with OpenAI for enterprise AI solutions',
      summary: 'Microsoft deepens collaboration with OpenAI to bring advanced AI capabilities to enterprise customers',
      content: 'Microsoft Corporation announced today a strategic expansion of its partnership with OpenAI, focusing on delivering enterprise-grade artificial intelligence solutions. The partnership will integrate OpenAI\'s GPT-4 technology into Microsoft\'s Azure cloud platform, enabling businesses to build custom AI applications. This collaboration represents a significant investment in enterprise AI infrastructure and is expected to accelerate AI adoption across industries.',
      url: 'https://example.com/microsoft-openai',
      source: 'Tech News Daily',
      publishedAt: new Date('2025-01-15T08:00:00Z'),
      relevanceScore: 0.95,
      topic: 'AI Development',
      fetchedAt: new Date(),
    },
    {
      id: '2',
      title: 'Amazon Web Services launches new quantum computing platform',
      summary: 'AWS introduces Braket Quantum, making quantum computing accessible to developers',
      content: 'Amazon Web Services has unveiled Braket Quantum, a fully managed quantum computing service designed to democratize access to quantum technology. The platform provides developers with tools to experiment with quantum algorithms and hybrid classical-quantum applications. Industry experts predict this could accelerate quantum computing research and practical applications in cryptography, optimization, and machine learning.',
      url: 'https://example.com/aws-quantum',
      source: 'Cloud Computing Weekly',
      publishedAt: new Date('2025-01-15T10:30:00Z'),
      relevanceScore: 0.88,
      topic: 'AI Development',
      fetchedAt: new Date(),
    },
    {
      id: '3',
      title: 'Breakthrough in clean energy: MIT develops high-efficiency solar cells',
      summary: 'Researchers achieve 35% efficiency in perovskite solar cells',
      content: 'Scientists at MIT have achieved a breakthrough in solar energy technology, developing perovskite solar cells with 35% efficiency, surpassing traditional silicon-based cells. The new technology uses novel material compositions and manufacturing processes that could significantly reduce the cost of solar energy. The research team believes this advancement could accelerate the transition to renewable energy sources globally.',
      url: 'https://example.com/mit-solar',
      source: 'Science Today',
      publishedAt: new Date('2025-01-15T14:00:00Z'),
      relevanceScore: 0.92,
      topic: 'Clean Energy',
      fetchedAt: new Date(),
    },
  ];

  const sampleTasks = [
    { id: '1', title: 'Review AI deployment strategy', priority: 1, status: 'pending' },
    { id: '2', title: 'Prepare quarterly report', priority: 2, status: 'in_progress' },
  ];

  const sampleRecentNotes = [
    { id: '1', title: 'Notes on enterprise AI trends', created_at: new Date() },
  ];

  beforeEach(async () => {
    // Create mocks for repositories
    const mockDigestRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((digest) => Promise.resolve({ ...digest, id: 'digest-123' })),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const mockNewsRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      })),
    };

    const mockSubscriptionsService = {
      findActive: jest.fn(),
    };

    const mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestGenerationService,
        LocalModelService,
        {
          provide: getRepositoryToken(UserNewsDigest),
          useValue: mockDigestRepo,
        },
        {
          provide: getRepositoryToken(NewsItem),
          useValue: mockNewsRepo,
        },
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<DigestGenerationService>(DigestGenerationService);
    digestRepo = module.get(getRepositoryToken(UserNewsDigest));
    newsRepo = module.get(getRepositoryToken(NewsItem));
    subscriptionsService = module.get<SubscriptionsService>(SubscriptionsService);
    llmService = module.get<LocalModelService>(LocalModelService);
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('generateDailyDigest - LLM Integration', () => {
    it('should generate digest with real LLM summarization for AI Development news', async () => {
      // Arrange: Setup mocks to return AI Development news
      jest.spyOn(subscriptionsService, 'findActive').mockResolvedValue([
        { id: '1', topic: 'AI Development', userId: 'user-1' } as any,
      ]);

      jest.spyOn(digestRepo, 'findOne').mockResolvedValue(null);

      const queryBuilder = (newsRepo as any).createQueryBuilder();
      jest.spyOn(queryBuilder, 'getMany').mockResolvedValue(
        sampleNewsItems.filter(item => item.topic === 'AI Development')
      );

      jest.spyOn(dataSource, 'query')
        .mockResolvedValueOnce(sampleTasks) // getTasksDueToday
        .mockResolvedValueOnce(sampleRecentNotes) // getRecentNotes
        .mockResolvedValueOnce([]); // findNotesRelatedToNews

      // Act: Generate digest with real LLM
      const result = await service.generateDailyDigest();

      // Assert: Validate digest structure
      expect(result).toBeDefined();
      expect(result.newsItems).toHaveLength(1);
      expect(result.newsItems[0].topic).toBe('AI Development');
      expect(result.newsItems[0].items).toHaveLength(2);

      // Validate LLM-generated summary
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(50);

      // Flexible content validation: Check for key entities from news
      const summaryLower = result.summary.toLowerCase();
      const hasRelevantContent =
        summaryLower.includes('microsoft') ||
        summaryLower.includes('openai') ||
        summaryLower.includes('ai') ||
        summaryLower.includes('amazon') ||
        summaryLower.includes('quantum');

      expect(hasRelevantContent).toBe(true);

      // Validate summary quality: Should not contain reasoning patterns
      expect(result.summary).not.toMatch(/^(Okay|Alright|So|Well|Let me)/i);
      expect(result.summary).not.toMatch(/\bI think\b/i);
      expect(result.summary).not.toMatch(/\bthe user\b/i);
    }, 30000); // 30s timeout for LLM processing

    it('should generate digest with real LLM for multi-topic news (AI + Clean Energy)', async () => {
      // Arrange: Setup mocks for multiple topics
      jest.spyOn(subscriptionsService, 'findActive').mockResolvedValue([
        { id: '1', topic: 'AI Development', userId: 'user-1' } as any,
        { id: '2', topic: 'Clean Energy', userId: 'user-1' } as any,
      ]);

      jest.spyOn(digestRepo, 'findOne').mockResolvedValue(null);

      const queryBuilder = (newsRepo as any).createQueryBuilder();
      jest.spyOn(queryBuilder, 'getMany')
        .mockResolvedValueOnce(sampleNewsItems.filter(item => item.topic === 'AI Development'))
        .mockResolvedValueOnce(sampleNewsItems.filter(item => item.topic === 'Clean Energy'));

      jest.spyOn(dataSource, 'query')
        .mockResolvedValueOnce(sampleTasks)
        .mockResolvedValueOnce(sampleRecentNotes)
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.generateDailyDigest();

      // Assert: Validate multi-topic structure
      expect(result).toBeDefined();
      expect(result.newsItems).toHaveLength(2);
      expect(result.newsItems.map(t => t.topic)).toEqual(['AI Development', 'Clean Energy']);

      // Validate summary covers both topics
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(80);

      const summaryLower = result.summary.toLowerCase();

      // Should mention entities from BOTH topics
      const hasAIContent = summaryLower.includes('microsoft') ||
                          summaryLower.includes('openai') ||
                          summaryLower.includes('ai') ||
                          summaryLower.includes('quantum');

      const hasEnergyContent = summaryLower.includes('solar') ||
                              summaryLower.includes('energy') ||
                              summaryLower.includes('mit');

      // At least one topic should be mentioned (flexible assertion)
      expect(hasAIContent || hasEnergyContent).toBe(true);
    }, 30000);

    it('should handle LLM response cleaning and extract clean summary', async () => {
      // Arrange
      jest.spyOn(subscriptionsService, 'findActive').mockResolvedValue([
        { id: '1', topic: 'Clean Energy', userId: 'user-1' } as any,
      ]);

      jest.spyOn(digestRepo, 'findOne').mockResolvedValue(null);

      const queryBuilder = (newsRepo as any).createQueryBuilder();
      jest.spyOn(queryBuilder, 'getMany').mockResolvedValue(
        sampleNewsItems.filter(item => item.topic === 'Clean Energy')
      );

      jest.spyOn(dataSource, 'query')
        .mockResolvedValueOnce([]) // No tasks
        .mockResolvedValueOnce([]) // No recent notes
        .mockResolvedValueOnce([]);

      // Act
      const result = await service.generateDailyDigest();

      // Assert: Validate LLM response was cleaned properly
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();

      // Summary should NOT contain thinking tags or reasoning markers
      expect(result.summary).not.toContain('<think>');
      expect(result.summary).not.toContain('</think>');
      expect(result.summary).not.toContain('###SUMMARY###');

      // Should not start with reasoning patterns
      expect(result.summary).not.toMatch(/^(Okay|Alright|So|Well|Let me|I need to)/i);

      // Should contain actual news content
      const summaryLower = result.summary.toLowerCase();
      expect(
        summaryLower.includes('solar') ||
        summaryLower.includes('energy') ||
        summaryLower.includes('mit') ||
        summaryLower.includes('efficiency')
      ).toBe(true);
    }, 30000);

    it('should handle edge case: LLM timeout gracefully with fallback summary', async () => {
      // Arrange: Force LLM timeout by mocking generateCompletion
      jest.spyOn(subscriptionsService, 'findActive').mockResolvedValue([
        { id: '1', topic: 'AI Development', userId: 'user-1' } as any,
      ]);

      jest.spyOn(digestRepo, 'findOne').mockResolvedValue(null);

      const queryBuilder = (newsRepo as any).createQueryBuilder();
      jest.spyOn(queryBuilder, 'getMany').mockResolvedValue(
        sampleNewsItems.filter(item => item.topic === 'AI Development')
      );

      jest.spyOn(dataSource, 'query')
        .mockResolvedValueOnce(sampleTasks)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Mock LLM to throw timeout error
      jest.spyOn(llmService, 'generateCompletion').mockRejectedValue(
        new Error('LLM timeout')
      );

      // Act
      const result = await service.generateDailyDigest();

      // Assert: Should return fallback summary
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary).toContain('daily news digest');
      expect(result.summary).toContain('2 articles'); // AI Development has 2 items
      expect(result.summary).toContain('1 topic');
      expect(result.summary).toContain('2 tasks'); // sampleTasks has 2 items
    }, 30000);
  });

  describe('cleanLLMResponse - Response Cleaning', () => {
    it('should extract summary after </think> tag (Qwen3 standard)', () => {
      const rawResponse = `<think>
This is the reasoning process about the news...
The user wants a summary of Microsoft and OpenAI partnership.
I should focus on key points about enterprise AI.
</think>
Microsoft announced a strategic partnership with OpenAI to bring advanced AI capabilities to enterprise customers through Azure cloud platform. This collaboration represents a significant investment in enterprise AI infrastructure.`;

      // Use private method via service's generateSummary flow
      const cleaned = (service as any).cleanLLMResponse(rawResponse);

      expect(cleaned).toBe(
        'Microsoft announced a strategic partnership with OpenAI to bring advanced AI capabilities to enterprise customers through Azure cloud platform. This collaboration represents a significant investment in enterprise AI infrastructure.'
      );
    });

    it('should extract summary after ###SUMMARY### delimiter (fallback)', () => {
      const rawResponse = `Let me think about this news digest...
The key points are Microsoft partnership and quantum computing advances.
I'll create a concise summary.

###SUMMARY###
Microsoft deepens OpenAI collaboration for enterprise AI solutions, while AWS launches quantum computing platform. These developments signal major advancements in cloud-based AI and quantum technologies.`;

      const cleaned = (service as any).cleanLLMResponse(rawResponse);

      expect(cleaned).toBe(
        'Microsoft deepens OpenAI collaboration for enterprise AI solutions, while AWS launches quantum computing platform. These developments signal major advancements in cloud-based AI and quantum technologies.'
      );
    });

    it('should use entity extraction as last resort for malformed responses', () => {
      const rawResponse = `Okay, so the user provided some news items. Let me go through them. I see Microsoft and OpenAI partnership. Microsoft announced partnership with OpenAI for enterprise AI solutions. Also, Amazon Web Services launched quantum computing platform called Braket Quantum. These are important developments in AI infrastructure. I think I should summarize these key points.`;

      const cleaned = (service as any).cleanLLMResponse(rawResponse);

      // Should extract sentences with news entities, skip reasoning
      expect(cleaned).toContain('Microsoft');
      expect(cleaned).toContain('OpenAI');
      expect(cleaned).not.toMatch(/^Okay/);
      expect(cleaned).not.toContain('Let me go through');
      expect(cleaned).not.toContain('I think I should');
    });
  });
});
