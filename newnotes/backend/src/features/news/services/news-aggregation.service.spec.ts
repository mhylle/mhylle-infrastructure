import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsAggregationService } from './news-aggregation.service';
import { NewsItem } from '../entities/news-item.entity';
import { TavilyClient } from '../clients/tavily.client';
import { SubscriptionsService } from '../../interests/services/subscriptions.service';
import { DigestGenerationService } from './digest-generation.service';
import { FeedbackService } from './feedback.service';

describe('NewsAggregationService', () => {
  let service: NewsAggregationService;
  let newsRepo: Repository<NewsItem>;
  let tavilyClient: TavilyClient;
  let subscriptionsService: SubscriptionsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockTavilyClient = {
    search: jest.fn(),
  };

  const mockSubscriptionsService = {
    findActive: jest.fn(),
    updateLastFetch: jest.fn(),
  };

  const mockDigestGenerationService = {
    generateDailyDigest: jest.fn(),
  };

  const mockFeedbackService = {
    analyzeEngagement: jest.fn(),
    adjustInterestConfidence: jest.fn(),
    suggestUnsubscribe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsAggregationService,
        {
          provide: getRepositoryToken(NewsItem),
          useValue: mockRepository,
        },
        {
          provide: TavilyClient,
          useValue: mockTavilyClient,
        },
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
        {
          provide: DigestGenerationService,
          useValue: mockDigestGenerationService,
        },
        {
          provide: FeedbackService,
          useValue: mockFeedbackService,
        },
      ],
    }).compile();

    service = module.get<NewsAggregationService>(NewsAggregationService);
    newsRepo = module.get<Repository<NewsItem>>(getRepositoryToken(NewsItem));
    tavilyClient = module.get<TavilyClient>(TavilyClient);
    subscriptionsService = module.get<SubscriptionsService>(
      SubscriptionsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('triggerAggregation', () => {
    it('should fetch and store news for active subscriptions', async () => {
      const subscriptions = [{ id: '1', topic: 'AI', enabled: true }];

      const tavilyResults = [
        {
          title: 'AI News',
          content: 'Latest AI developments',
          url: 'https://example.com/ai-news',
          score: 0.85,
          published_date: '2025-01-01',
          source: 'example.com',
        },
      ];

      mockSubscriptionsService.findActive.mockResolvedValue(subscriptions);
      mockTavilyClient.search.mockResolvedValue(tavilyResults);
      mockRepository.create.mockReturnValue({
        topic: 'AI',
        title: 'AI News',
        summary: 'Latest AI developments',
        url: 'https://example.com/ai-news',
        source: 'example.com',
        publishedAt: new Date('2025-01-01'),
        relevanceScore: 0.85,
      });
      mockRepository.save.mockResolvedValue({});
      mockDigestGenerationService.generateDailyDigest.mockResolvedValue(undefined);

      const result = await service.triggerAggregation();

      expect(result.fetched).toBe(1);
      expect(result.stored).toBe(1);
      expect(mockSubscriptionsService.updateLastFetch).toHaveBeenCalledWith(
        '1',
      );
      expect(mockDigestGenerationService.generateDailyDigest).toHaveBeenCalled();
    });

    it('should filter out results with score <= 0.7', async () => {
      const subscriptions = [{ id: '1', topic: 'Tech', enabled: true }];

      const tavilyResults = [
        {
          title: 'High Relevance',
          content: 'Content',
          url: 'https://example.com/high',
          score: 0.85,
          published_date: '2025-01-01',
          source: 'example.com',
        },
        {
          title: 'Low Relevance',
          content: 'Content',
          url: 'https://example.com/low',
          score: 0.5,
          published_date: '2025-01-01',
          source: 'example.com',
        },
      ];

      mockSubscriptionsService.findActive.mockResolvedValue(subscriptions);
      mockTavilyClient.search.mockResolvedValue(tavilyResults);
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});
      mockDigestGenerationService.generateDailyDigest.mockResolvedValue(undefined);

      const result = await service.triggerAggregation();

      expect(result.fetched).toBe(2);
      expect(result.stored).toBe(1); // Only high relevance stored
    });

    it('should handle duplicate URLs gracefully', async () => {
      const subscriptions = [{ id: '1', topic: 'AI', enabled: true }];

      const tavilyResults = [
        {
          title: 'AI News',
          content: 'Content',
          url: 'https://example.com/ai-news',
          score: 0.85,
          published_date: '2025-01-01',
          source: 'example.com',
        },
      ];

      mockSubscriptionsService.findActive.mockResolvedValue(subscriptions);
      mockTavilyClient.search.mockResolvedValue(tavilyResults);
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockRejectedValue({ code: '23505' }); // Duplicate key error
      mockDigestGenerationService.generateDailyDigest.mockResolvedValue(undefined);

      const result = await service.triggerAggregation();

      expect(result.fetched).toBe(1);
      expect(result.stored).toBe(0); // Duplicate not stored
    });
  });

  describe('getNewsByTopic', () => {
    it('should return news items for a specific topic', async () => {
      const mockNews = [
        {
          id: '1',
          topic: 'AI',
          title: 'AI News',
          url: 'https://example.com',
        },
      ];

      mockRepository.find.mockResolvedValue(mockNews);

      const result = await service.getNewsByTopic('AI', 10);

      expect(result).toEqual(mockNews);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { topic: 'AI' },
        order: { publishedAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getRecentNews', () => {
    it('should return recent news items', async () => {
      const mockNews = [
        {
          id: '1',
          topic: 'AI',
          title: 'AI News',
          url: 'https://example.com',
        },
      ];

      mockRepository.find.mockResolvedValue(mockNews);

      const result = await service.getRecentNews(50);

      expect(result).toEqual(mockNews);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { fetchedAt: 'DESC' },
        take: 50,
      });
    });
  });
});
