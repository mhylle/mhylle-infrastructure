import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InterestDetectionService } from './interest-detection.service';
import { UserInterest } from '../entities/user-interest.entity';
import { InterestEvidence } from '../entities/interest-evidence.entity';
import { Note } from '../../../shared/entities/note.entity';
import { LocalModelService } from '../../llm-service/services/local-model.service';
import { InterestSimilarityService } from './interest-similarity.service';
import { InterestHierarchyService } from './interest-hierarchy.service';

describe('InterestDetectionService', () => {
  let service: InterestDetectionService;
  let interestsRepo: Repository<UserInterest>;
  let evidenceRepo: Repository<InterestEvidence>;
  let notesRepo: Repository<Note>;
  let dataSource: DataSource;
  let localModelService: LocalModelService;

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

  const mockLocalModelService = {
    generateCompletion: jest.fn(),
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

  beforeEach(async () => {
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
        {
          provide: LocalModelService,
          useValue: mockLocalModelService,
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

    service = module.get<InterestDetectionService>(InterestDetectionService);
    interestsRepo = module.get(getRepositoryToken(UserInterest));
    evidenceRepo = module.get(getRepositoryToken(InterestEvidence));
    notesRepo = module.get(getRepositoryToken(Note));
    dataSource = module.get(DataSource);
    localModelService = module.get(LocalModelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getInterests', () => {
    it('should fetch interests with default min confidence', async () => {
      const mockInterests = [
        {
          id: '1',
          topic: 'programming',
          confidence: 0.8,
          sourceType: 'notes',
          evidenceCount: 5,
        },
      ];

      mockInterestsRepo.find.mockResolvedValue(mockInterests);

      const result = await service.getInterests();

      expect(result).toEqual(mockInterests);
      expect(mockInterestsRepo.find).toHaveBeenCalledWith({
        where: { confidence: expect.anything() },
        order: { confidence: 'DESC' },
      });
    });

    it('should fetch interests with custom min confidence', async () => {
      const mockInterests = [
        {
          id: '1',
          topic: 'programming',
          confidence: 0.9,
          sourceType: 'notes',
          evidenceCount: 5,
        },
      ];

      mockInterestsRepo.find.mockResolvedValue(mockInterests);

      const result = await service.getInterests(0.8);

      expect(result).toEqual(mockInterests);
      expect(mockInterestsRepo.find).toHaveBeenCalled();
    });
  });

  describe('deleteInterest', () => {
    it('should delete an interest by id', async () => {
      const interestId = 'test-id-123';

      await service.deleteInterest(interestId);

      expect(mockInterestsRepo.delete).toHaveBeenCalledWith(interestId);
    });
  });

  describe('boostConfidence', () => {
    it('should boost confidence for an existing interest', async () => {
      const mockInterest = {
        id: '1',
        topic: 'programming',
        confidence: 0.7,
        sourceType: 'notes',
        evidenceCount: 5,
        lastSeen: new Date(),
      };

      mockInterestsRepo.findOne.mockResolvedValue(mockInterest);
      mockInterestsRepo.save.mockResolvedValue({
        ...mockInterest,
        confidence: 0.8,
      });

      await service.boostConfidence('programming', 0.1);

      expect(mockInterestsRepo.findOne).toHaveBeenCalledWith({
        where: { topic: 'programming' },
      });
      expect(mockInterestsRepo.save).toHaveBeenCalled();
    });

    it('should cap confidence at 1.0', async () => {
      const mockInterest = {
        id: '1',
        topic: 'programming',
        confidence: 0.95,
        sourceType: 'notes',
        evidenceCount: 5,
        lastSeen: new Date(),
      };

      mockInterestsRepo.findOne.mockResolvedValue(mockInterest);

      await service.boostConfidence('programming', 0.2);

      expect(mockInterestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 1.0,
        }),
      );
    });

    it('should handle non-existent topic gracefully', async () => {
      mockInterestsRepo.findOne.mockResolvedValue(null);

      await service.boostConfidence('nonexistent', 0.1);

      expect(mockInterestsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reduceConfidence', () => {
    it('should reduce confidence for an existing interest', async () => {
      const mockInterest = {
        id: '1',
        topic: 'programming',
        confidence: 0.8,
        sourceType: 'notes',
        evidenceCount: 5,
        lastSeen: new Date(),
      };

      mockInterestsRepo.findOne.mockResolvedValue(mockInterest);
      mockInterestsRepo.save.mockResolvedValue({
        ...mockInterest,
        confidence: 0.7,
      });

      await service.reduceConfidence('programming', 0.1);

      expect(mockInterestsRepo.findOne).toHaveBeenCalledWith({
        where: { topic: 'programming' },
      });
      expect(mockInterestsRepo.save).toHaveBeenCalled();
    });

    it('should floor confidence at 0.0', async () => {
      const mockInterest = {
        id: '1',
        topic: 'programming',
        confidence: 0.05,
        sourceType: 'notes',
        evidenceCount: 5,
        lastSeen: new Date(),
      };

      mockInterestsRepo.findOne.mockResolvedValue(mockInterest);

      await service.reduceConfidence('programming', 0.2);

      expect(mockInterestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 0,
        }),
      );
    });
  });

  describe('detectInterests', () => {
    it('should detect interests from notes and tasks', async () => {
      const mockNotes = [
        {
          id: '1',
          content: 'I love programming in TypeScript',
          created_at: new Date(),
        },
        {
          id: '2',
          content: 'Learning NestJS framework',
          created_at: new Date(),
        },
      ];

      const mockTasks = [
        { id: '1', title: 'Complete TypeScript tutorial' },
        { id: '2', title: 'Build NestJS API' },
      ];

      const mockChatMessages = [
        { id: '1', content: 'How do I use TypeScript?', role: 'user' },
      ];

      const mockLLMResponse = {
        text: '[{"name": "TypeScript", "score": 0.9, "count": 2}, {"name": "NestJS", "score": 0.8, "count": 2}]',
        model: 'test-model',
        tokensUsed: 100,
      };

      mockNotesRepo.find.mockResolvedValue(mockNotes);
      mockDataSource.query
        .mockResolvedValueOnce(mockTasks)
        .mockResolvedValueOnce(mockChatMessages);
      mockLocalModelService.generateCompletion.mockResolvedValue(
        mockLLMResponse,
      );
      mockInterestsRepo.findOne.mockResolvedValue(null);
      mockInterestsRepo.create.mockImplementation((data) => data);
      mockInterestsRepo.save.mockImplementation((data) => ({
        ...data,
        id: 'generated-id',
      }));

      const result = await service.detectInterests();

      expect(mockNotesRepo.find).toHaveBeenCalled();
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
      expect(mockLocalModelService.generateCompletion).toHaveBeenCalledTimes(3);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty notes and tasks gracefully', async () => {
      mockNotesRepo.find.mockResolvedValue([]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.detectInterests();

      expect(result).toEqual([]);
    });

    it('should handle LLM errors gracefully', async () => {
      const mockNotes = [
        {
          id: '1',
          content: 'Test content',
          created_at: new Date(),
        },
      ];

      mockNotesRepo.find.mockResolvedValue(mockNotes);
      mockDataSource.query.mockResolvedValue([]);
      mockLocalModelService.generateCompletion.mockRejectedValue(
        new Error('LLM error'),
      );

      const result = await service.detectInterests();

      expect(result).toEqual([]);
    });
  });
});
