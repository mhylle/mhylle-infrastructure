import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { SearchService } from './search.service';
import { EmbeddingsService } from '@features/embeddings/services/embeddings.service';
import { SearchMode } from '../dto/search.dto';

describe('SearchService', () => {
  let service: SearchService;
  let dataSource: DataSource;
  let embeddingsService: EmbeddingsService;

  const mockEmbedding = Array.from({ length: 384 }, (_, i) => i * 0.001);

  const mockSemanticResults = [
    {
      id: '1',
      title: 'Test Note 1',
      content: 'Content about Docker',
      snippet: 'Content about Docker',
      score: 0.9,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      title: 'Test Note 2',
      content: 'More Docker content',
      snippet: 'More Docker content',
      score: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockKeywordResults = [
    {
      id: '1',
      title: 'Test Note 1',
      content: 'Content about Docker',
      snippet: '<b>Docker</b> content highlighted',
      score: 0.7,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
        {
          provide: EmbeddingsService,
          useValue: {
            generateEmbedding: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    dataSource = module.get<DataSource>(DataSource);
    embeddingsService = module.get<EmbeddingsService>(EmbeddingsService);
  });

  describe('search', () => {
    it('should perform semantic search when mode is semantic', async () => {
      jest
        .spyOn(embeddingsService, 'generateEmbedding')
        .mockResolvedValue(mockEmbedding);
      jest
        .spyOn(dataSource, 'query')
        .mockResolvedValue(mockSemanticResults);

      const result = await service.search({
        query: 'docker best practices',
        mode: SearchMode.SEMANTIC,
        limit: 10,
      });

      expect(result.results).toHaveLength(2);
      expect(result.mode).toBe(SearchMode.SEMANTIC);
      expect(result.results[0].searchType).toBe('semantic');
      expect(embeddingsService.generateEmbedding).toHaveBeenCalledWith(
        'docker best practices',
      );
    });

    it('should perform keyword search when mode is keyword', async () => {
      jest
        .spyOn(dataSource, 'query')
        .mockResolvedValue(mockKeywordResults);

      const result = await service.search({
        query: 'docker',
        mode: SearchMode.KEYWORD,
        limit: 10,
      });

      expect(result.results).toHaveLength(1);
      expect(result.mode).toBe(SearchMode.KEYWORD);
      expect(result.results[0].searchType).toBe('keyword');
      expect(embeddingsService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should perform hybrid search by default', async () => {
      jest
        .spyOn(embeddingsService, 'generateEmbedding')
        .mockResolvedValue(mockEmbedding);
      jest
        .spyOn(dataSource, 'query')
        .mockResolvedValueOnce(mockSemanticResults)
        .mockResolvedValueOnce(mockKeywordResults);

      const result = await service.search({
        query: 'docker',
        limit: 10,
      });

      expect(result.mode).toBe(SearchMode.HYBRID);
      expect(result.results[0].searchType).toBe('hybrid');
      expect(embeddingsService.generateEmbedding).toHaveBeenCalled();
    });

    it('should filter results by minimum score', async () => {
      jest
        .spyOn(embeddingsService, 'generateEmbedding')
        .mockResolvedValue(mockEmbedding);
      jest
        .spyOn(dataSource, 'query')
        .mockResolvedValue(mockSemanticResults);

      const result = await service.search({
        query: 'docker',
        mode: SearchMode.SEMANTIC,
        limit: 10,
        minScore: 0.85,
      });

      // Only score 0.9 should pass the 0.85 threshold
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should respect limit parameter', async () => {
      const manyResults = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        snippet: `Content ${i}`,
        score: 0.9 - i * 0.01,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      jest
        .spyOn(embeddingsService, 'generateEmbedding')
        .mockResolvedValue(mockEmbedding);
      jest.spyOn(dataSource, 'query').mockResolvedValue(manyResults);

      const result = await service.search({
        query: 'test',
        mode: SearchMode.SEMANTIC,
        limit: 5,
      });

      expect(result.results).toHaveLength(5);
    });

    it('should include processing time in response', async () => {
      jest
        .spyOn(embeddingsService, 'generateEmbedding')
        .mockResolvedValue(mockEmbedding);
      jest
        .spyOn(dataSource, 'query')
        .mockResolvedValue(mockSemanticResults);

      const result = await service.search({
        query: 'test',
        mode: SearchMode.SEMANTIC,
        limit: 10,
      });

      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle empty results gracefully', async () => {
      jest
        .spyOn(embeddingsService, 'generateEmbedding')
        .mockResolvedValue(mockEmbedding);
      jest.spyOn(dataSource, 'query').mockResolvedValue([]);

      const result = await service.search({
        query: 'nonexistent',
        mode: SearchMode.SEMANTIC,
        limit: 10,
      });

      expect(result.results).toEqual([]);
      expect(result.totalResults).toBe(0);
    });

    it('should combine scores in hybrid search', async () => {
      jest
        .spyOn(embeddingsService, 'generateEmbedding')
        .mockResolvedValue(mockEmbedding);
      jest
        .spyOn(dataSource, 'query')
        .mockResolvedValueOnce([
          {
            id: '1',
            title: 'Note 1',
            content: 'Content',
            snippet: 'Content',
            score: 0.9,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: '1',
            title: 'Note 1',
            content: 'Content',
            snippet: 'Highlighted content',
            score: 0.6,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

      const result = await service.search({
        query: 'test',
        mode: SearchMode.HYBRID,
        limit: 10,
      });

      // Score should be: 0.9 * 0.7 + 0.6 * 0.3 = 0.63 + 0.18 = 0.81
      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBeCloseTo(0.81, 2);
      expect(result.results[0].snippet).toBe('Highlighted content');
    });
  });
});
