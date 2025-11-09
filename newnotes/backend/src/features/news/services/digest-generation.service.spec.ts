import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DigestGenerationService } from './digest-generation.service';
import { UserNewsDigest } from '../entities/user-news-digest.entity';
import { NewsItem } from '../entities/news-item.entity';
import { SubscriptionsService } from '../../interests/services/subscriptions.service';
import { LocalModelService } from '../../llm-service/services/local-model.service';

describe('DigestGenerationService', () => {
  let service: DigestGenerationService;
  let digestRepo: Repository<UserNewsDigest>;

  const mockDigestRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockNewsRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockSubscriptionsService = {
    findActive: jest.fn(),
  };

  const mockLlmService = {
    generateCompletion: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestGenerationService,
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
          provide: LocalModelService,
          useValue: mockLlmService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<DigestGenerationService>(DigestGenerationService);
    digestRepo = module.get<Repository<UserNewsDigest>>(
      getRepositoryToken(UserNewsDigest),
    );

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTodaysDigest', () => {
    it('should return todays digest if it exists', async () => {
      const digest = { id: '1', digestDate: new Date() };
      mockDigestRepo.findOne.mockResolvedValue(digest);

      const result = await service.getTodaysDigest();
      expect(result).toEqual(digest);
    });

    it('should return null if no digest exists', async () => {
      mockDigestRepo.findOne.mockResolvedValue(null);

      const result = await service.getTodaysDigest();
      expect(result).toBeNull();
    });
  });

  describe('getRecentDigests', () => {
    it('should return recent digests with default limit', async () => {
      const digests = [
        { id: '1', digestDate: new Date() },
        { id: '2', digestDate: new Date() },
      ];
      mockDigestRepo.find.mockResolvedValue(digests);

      const result = await service.getRecentDigests();
      expect(result).toEqual(digests);
      expect(mockDigestRepo.find).toHaveBeenCalledWith({
        order: { digestDate: 'DESC' },
        take: 7,
      });
    });

    it('should accept custom limit', async () => {
      const digests = [{ id: '1', digestDate: new Date() }];
      mockDigestRepo.find.mockResolvedValue(digests);

      const result = await service.getRecentDigests(3);
      expect(result).toEqual(digests);
      expect(mockDigestRepo.find).toHaveBeenCalledWith({
        order: { digestDate: 'DESC' },
        take: 3,
      });
    });
  });

  describe('getDigestByDate', () => {
    it('should return digest for specific date', async () => {
      const testDate = new Date('2025-01-15');
      const digest = { id: '1', digestDate: testDate };
      mockDigestRepo.findOne.mockResolvedValue(digest);

      const result = await service.getDigestByDate(testDate);
      expect(result).toEqual(digest);
      expect(mockDigestRepo.findOne).toHaveBeenCalledWith({
        where: { digestDate: testDate },
      });
    });
  });

  describe('markDigestAsViewed', () => {
    it('should update viewed status', async () => {
      await service.markDigestAsViewed('123');

      expect(mockDigestRepo.update).toHaveBeenCalledWith('123', {
        viewed: true,
      });
    });
  });

  describe('generateDailyDigest', () => {
    it('should delete existing digest and regenerate', async () => {
      const existingDigest = { id: '1', digestDate: new Date() };
      mockDigestRepo.findOne.mockResolvedValue(existingDigest);
      mockDigestRepo.remove.mockResolvedValue(existingDigest);
      mockSubscriptionsService.findActive.mockResolvedValue([]);

      const result = await service.generateDailyDigest();

      expect(mockDigestRepo.remove).toHaveBeenCalledWith(existingDigest);
      expect(mockSubscriptionsService.findActive).toHaveBeenCalled();
      expect(result).toBeNull(); // Returns null because no subscriptions
    });

    it('should return null if no active subscriptions', async () => {
      mockDigestRepo.findOne.mockResolvedValue(null);
      mockSubscriptionsService.findActive.mockResolvedValue([]);

      const result = await service.generateDailyDigest();

      expect(result).toBeNull();
      expect(mockDigestRepo.create).not.toHaveBeenCalled();
    });

    it('should return null if no news items found', async () => {
      mockDigestRepo.findOne.mockResolvedValue(null);
      mockSubscriptionsService.findActive.mockResolvedValue([
        { id: '1', topic: 'AI', enabled: true },
      ]);

      // Mock empty news results
      mockNewsRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.generateDailyDigest();

      expect(result).toBeNull();
    });

    it('should generate digest with news, tasks, and LLM summary', async () => {
      mockDigestRepo.findOne.mockResolvedValue(null);
      mockSubscriptionsService.findActive.mockResolvedValue([
        { id: '1', topic: 'AI', enabled: true },
      ]);

      // Mock news items
      const newsItems = [
        {
          id: '1',
          title: 'AI Breakthrough',
          summary: 'New AI model released',
          url: 'http://example.com/ai',
          source: 'example.com',
          publishedAt: new Date(),
          relevanceScore: 0.9,
        },
      ];

      mockNewsRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(newsItems),
      });

      // Mock tasks and notes
      mockDataSource.query
        .mockResolvedValueOnce([
          { id: '1', title: 'Complete report', priority: 'high', status: 'todo' },
        ]) // tasks
        .mockResolvedValueOnce([{ id: '1', title: 'Meeting notes' }]) // recent notes
        .mockResolvedValueOnce([{ id: '2', title: 'AI Research' }]); // related notes

      // Mock LLM response
      mockLlmService.generateCompletion.mockResolvedValue({
        text: 'Your AI digest is ready with 1 article and 1 task.',
        model: 'deepseek-r1:32b',
        tokensUsed: 100,
      });

      const createdDigest = {
        id: 'digest-1',
        digestDate: new Date(),
        newsItems: [{ topic: 'AI', items: newsItems }],
        summary: 'Your AI digest is ready with 1 article and 1 task.',
        tasks: [{ id: '1', title: 'Complete report' }],
        insights: { recentNotes: 1, relatedTopics: 1 },
        viewed: false,
      };

      mockDigestRepo.create.mockReturnValue(createdDigest);
      mockDigestRepo.save.mockResolvedValue(createdDigest);

      const result = await service.generateDailyDigest();

      expect(result).toEqual(createdDigest);
      expect(mockDigestRepo.create).toHaveBeenCalled();
      expect(mockDigestRepo.save).toHaveBeenCalled();
      expect(mockLlmService.generateCompletion).toHaveBeenCalled();
    });

    it('should use fallback summary if LLM fails', async () => {
      mockDigestRepo.findOne.mockResolvedValue(null);
      mockSubscriptionsService.findActive.mockResolvedValue([
        { id: '1', topic: 'Tech', enabled: true },
      ]);

      const newsItems = [
        {
          id: '1',
          title: 'Tech News',
          summary: 'Latest tech',
          url: 'http://example.com',
          source: 'example.com',
          publishedAt: new Date(),
          relevanceScore: 0.8,
        },
      ];

      mockNewsRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(newsItems),
      });

      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Mock LLM failure
      mockLlmService.generateCompletion.mockRejectedValue(
        new Error('LLM unavailable'),
      );

      const createdDigest = {
        id: 'digest-2',
        digestDate: new Date(),
        newsItems: [{ topic: 'Tech', items: newsItems }],
        summary: 'Your daily news digest is ready with updates on your interests.',
        tasks: [],
        insights: { recentNotes: 0, relatedTopics: 0 },
        viewed: false,
      };

      mockDigestRepo.create.mockReturnValue(createdDigest);
      mockDigestRepo.save.mockResolvedValue(createdDigest);

      const result = await service.generateDailyDigest();

      expect(result).toBeDefined();
      expect(result.summary).toBe(
        'Your daily news digest is ready with updates on your interests.',
      );
    });
  });
});
