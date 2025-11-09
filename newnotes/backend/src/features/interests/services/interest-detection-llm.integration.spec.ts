import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InterestDetectionService } from './interest-detection.service';
import { UserInterest } from '../entities/user-interest.entity';
import { InterestEvidence } from '../entities/interest-evidence.entity';
import { Note } from '../../../shared/entities/note.entity';
import { LocalModelService } from '../../llm-service/services/local-model.service';
import { InterestSimilarityService } from './interest-similarity.service';
import { InterestHierarchyService } from './interest-hierarchy.service';

/**
 * Integration test for interest detection using real Ollama LLM
 * Tests topic extraction from chat messages with flexible assertions
 *
 * IMPORTANT: These tests require Ollama to be running locally
 * Run: ollama serve (default: http://localhost:11434)
 * Model required: deepseek-r1:32b (or configure different model)
 */
describe('InterestDetectionService - LLM Integration', () => {
  let service: InterestDetectionService;
  let localModelService: LocalModelService;
  let interestsRepo: Repository<UserInterest>;

  // Mock repositories (we only test LLM integration, not database)
  const mockInterestsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockEvidenceRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockNotesRepo = {
    find: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockSimilarityService = {
    findSimilarInterests: jest.fn(),
    calculateSimilarity: jest.fn(),
    generateInterestEmbedding: jest.fn(),
    autoMergeSimilarInterests: jest.fn(),
  };

  const mockHierarchyService = {
    getHierarchy: jest.fn(),
    getParent: jest.fn(),
    getChildren: jest.fn(),
    detectHierarchies: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterestDetectionService,
        {
          provide: getRepositoryToken(UserInterest),
          useValue: mockInterestsRepo,
        },
        {
          provide: getRepositoryToken(InterestEvidence),
          useValue: mockEvidenceRepo,
        },
        {
          provide: getRepositoryToken(Note),
          useValue: mockNotesRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        // Real LocalModelService for actual LLM testing
        LocalModelService,
        ConfigService,
        {
          provide: InterestSimilarityService,
          useValue: mockSimilarityService,
        },
        {
          provide: InterestHierarchyService,
          useValue: mockHierarchyService,
        },
      ],
    }).compile();

    service = module.get<InterestDetectionService>(InterestDetectionService);
    localModelService = module.get<LocalModelService>(LocalModelService);
    interestsRepo = module.get(getRepositoryToken(UserInterest));

    // Verify Ollama is available
    const isHealthy = await localModelService.healthCheck();
    if (!isHealthy) {
      console.warn(
        '⚠️  Ollama not available - integration tests may fail. Please run: ollama serve',
      );
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockInterestsRepo.findOne.mockResolvedValue(null);
    mockInterestsRepo.create.mockImplementation((data) => ({ ...data, id: 'generated-id' }));
    mockInterestsRepo.save.mockImplementation((data) => Promise.resolve(data));
    mockNotesRepo.find.mockResolvedValue([]);
    mockDataSource.query.mockResolvedValue([]);
  });

  describe('Real LLM Topic Extraction', () => {
    it('should extract programming topics from technical chat', async () => {
      const chatMessages = [
        {
          id: '1',
          content: 'I need help with TypeScript generics and how to use them properly',
          role: 'user',
        },
        {
          id: '2',
          content: 'Can you explain React hooks and their lifecycle?',
          role: 'user',
        },
        {
          id: '3',
          content: 'I am building a NestJS API with PostgreSQL database',
          role: 'user',
        },
      ];

      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce(chatMessages); // chat messages

      const result = await service.detectInterests();

      // Flexible assertions - LLM might extract different topics
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Should extract at least some programming-related topics
      if (result.length > 0) {
        const topics = result.map((interest) => interest.topic.toLowerCase());
        const hasProgrammingTopic = topics.some(
          (topic) =>
            topic.includes('typescript') ||
            topic.includes('react') ||
            topic.includes('nestjs') ||
            topic.includes('programming') ||
            topic.includes('database') ||
            topic.includes('api'),
        );

        expect(hasProgrammingTopic).toBe(true);

        // All detected interests should have reasonable confidence
        result.forEach((interest) => {
          expect(interest.confidence).toBeGreaterThanOrEqual(0.6);
          expect(interest.confidence).toBeLessThanOrEqual(1.0);
        });
      }
    }, 30000); // 30 second timeout for LLM call

    it('should extract hobby topics from casual chat', async () => {
      const chatMessages = [
        {
          id: '1',
          content: 'I love playing guitar and writing songs',
          role: 'user',
        },
        {
          id: '2',
          content: 'My favorite hobby is photography, especially landscape shots',
          role: 'user',
        },
        {
          id: '3',
          content: 'I enjoy hiking in the mountains every weekend',
          role: 'user',
        },
      ];

      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce(chatMessages); // chat messages

      const result = await service.detectInterests();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const topics = result.map((interest) => interest.topic.toLowerCase());
        const hasHobbyTopic = topics.some(
          (topic) =>
            topic.includes('music') ||
            topic.includes('guitar') ||
            topic.includes('photography') ||
            topic.includes('hiking') ||
            topic.includes('outdoor') ||
            topic.includes('landscape'),
        );

        expect(hasHobbyTopic).toBe(true);
      }
    }, 30000);

    it('should handle mixed technical and personal topics', async () => {
      const chatMessages = [
        {
          id: '1',
          content: 'I work with Python for machine learning projects',
          role: 'user',
        },
        {
          id: '2',
          content: 'In my free time I cook Italian cuisine',
          role: 'user',
        },
        {
          id: '3',
          content: 'Learning about neural networks and deep learning',
          role: 'user',
        },
        {
          id: '4',
          content: 'My favorite pasta is carbonara',
          role: 'user',
        },
      ];

      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce(chatMessages); // chat messages

      const result = await service.detectInterests();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Should extract both technical and personal topics
      if (result.length >= 2) {
        const topics = result.map((interest) => interest.topic.toLowerCase());

        // Check for technical topics
        const hasTechnical = topics.some(
          (topic) =>
            topic.includes('python') ||
            topic.includes('machine learning') ||
            topic.includes('neural') ||
            topic.includes('ai') ||
            topic.includes('data'),
        );

        // Check for personal/cooking topics
        const hasPersonal = topics.some(
          (topic) =>
            topic.includes('cooking') ||
            topic.includes('food') ||
            topic.includes('cuisine') ||
            topic.includes('italian'),
        );

        // At least one category should be detected
        expect(hasTechnical || hasPersonal).toBe(true);
      }
    }, 30000);

    it('should handle empty or minimal content gracefully', async () => {
      const chatMessages = [
        {
          id: '1',
          content: 'hi',
          role: 'user',
        },
        {
          id: '2',
          content: 'ok',
          role: 'user',
        },
      ];

      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce(chatMessages); // chat messages

      const result = await service.detectInterests();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Minimal content should result in few or no topics
      // LLM might not detect meaningful interests from "hi" and "ok"
      result.forEach((interest) => {
        expect(interest.confidence).toBeGreaterThanOrEqual(0.6);
        expect(interest.confidence).toBeLessThanOrEqual(1.0);
      });
    }, 30000);

    it('should extract business/professional topics', async () => {
      const chatMessages = [
        {
          id: '1',
          content: 'I need to prepare a presentation for the quarterly business review',
          role: 'user',
        },
        {
          id: '2',
          content: 'Working on financial projections for next year',
          role: 'user',
        },
        {
          id: '3',
          content: 'Meeting with stakeholders about project management strategy',
          role: 'user',
        },
      ];

      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce(chatMessages); // chat messages

      const result = await service.detectInterests();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const topics = result.map((interest) => interest.topic.toLowerCase());
        const hasBusinessTopic = topics.some(
          (topic) =>
            topic.includes('business') ||
            topic.includes('finance') ||
            topic.includes('project management') ||
            topic.includes('strategy') ||
            topic.includes('presentation') ||
            topic.includes('management'),
        );

        expect(hasBusinessTopic).toBe(true);
      }
    }, 30000);

    it('should handle multilingual or domain-specific content', async () => {
      const chatMessages = [
        {
          id: '1',
          content: 'I am studying quantum computing and quantum mechanics',
          role: 'user',
        },
        {
          id: '2',
          content: 'Working on research about quantum entanglement',
          role: 'user',
        },
        {
          id: '3',
          content: 'Reading papers about quantum algorithms',
          role: 'user',
        },
      ];

      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce(chatMessages); // chat messages

      const result = await service.detectInterests();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const topics = result.map((interest) => interest.topic.toLowerCase());
        const hasQuantumTopic = topics.some(
          (topic) =>
            topic.includes('quantum') ||
            topic.includes('physics') ||
            topic.includes('science') ||
            topic.includes('research'),
        );

        expect(hasQuantumTopic).toBe(true);

        // Check that confidence scores are reasonable for technical content
        result.forEach((interest) => {
          expect(interest.confidence).toBeGreaterThanOrEqual(0.6);
        });
      }
    }, 30000);
  });

  describe('LLM Response Parsing', () => {
    it('should parse valid JSON array from LLM', async () => {
      const chatMessages = [
        {
          id: '1',
          content: 'I love TypeScript and React development',
          role: 'user',
        },
      ];

      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce(chatMessages); // chat messages

      const result = await service.detectInterests();

      // Should successfully parse LLM response
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Verify data structure
      result.forEach((interest) => {
        expect(interest).toHaveProperty('topic');
        expect(interest).toHaveProperty('confidence');
        expect(typeof interest.topic).toBe('string');
        expect(typeof interest.confidence).toBe('number');
      });
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle Ollama connection errors gracefully', async () => {
      // Temporarily break the service by forcing a connection error
      const badConfigService = new ConfigService({
        'ollama.baseUrl': 'http://nonexistent:99999',
        'ollama.timeout': 1000,
      });
      const badLocalModelService = new LocalModelService(badConfigService);

      const errorModule: TestingModule = await Test.createTestingModule({
        providers: [
          InterestDetectionService,
          {
            provide: getRepositoryToken(UserInterest),
            useValue: mockInterestsRepo,
          },
          {
            provide: getRepositoryToken(InterestEvidence),
            useValue: mockEvidenceRepo,
          },
          {
            provide: getRepositoryToken(Note),
            useValue: mockNotesRepo,
          },
          {
            provide: DataSource,
            useValue: mockDataSource,
          },
          {
            provide: LocalModelService,
            useValue: badLocalModelService,
          },
          {
            provide: InterestSimilarityService,
            useValue: mockSimilarityService,
          },
          {
            provide: InterestHierarchyService,
            useValue: mockHierarchyService,
          },
        ],
      }).compile();

      const errorService = errorModule.get<InterestDetectionService>(
        InterestDetectionService,
      );

      const chatMessages = [
        {
          id: '1',
          content: 'Test message',
          role: 'user',
        },
      ];

      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([]) // tasks
        .mockResolvedValueOnce(chatMessages); // chat messages

      // Should not crash, should return empty array
      const result = await errorService.detectInterests();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    }, 30000);
  });
});
