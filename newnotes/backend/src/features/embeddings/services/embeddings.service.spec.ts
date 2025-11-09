import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { EmbeddingsService } from './embeddings.service';
import { NoteEmbeddingRepository } from '../repositories/note-embedding.repository';
import { EmbeddingResponseDto } from '../dto/embedding.dto';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  let httpService: HttpService;
  let noteEmbeddingRepository: NoteEmbeddingRepository;

  const mockEmbedding = Array.from({ length: 384 }, (_, i) => i * 0.001);

  const mockEmbeddingResponse: EmbeddingResponseDto = {
    embedding: mockEmbedding,
    model: 'dengcao/Qwen3-Embedding-8B:Q4_K_M',
    dimension: 384,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://embeddings-service:8001'),
          },
        },
        {
          provide: NoteEmbeddingRepository,
          useValue: {
            upsert: jest.fn(),
            deleteByNoteId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
    httpService = module.get<HttpService>(HttpService);
    noteEmbeddingRepository = module.get<NoteEmbeddingRepository>(
      NoteEmbeddingRepository,
    );
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(of({ data: mockEmbeddingResponse } as any));

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://embeddings-service:8001/api/embeddings/generate',
        {
          text: 'test text',
          model: 'dengcao/Qwen3-Embedding-8B:Q4_K_M',
        },
      );
    });

    it('should throw error when API call fails', async () => {
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(throwError(() => new Error('API Error')));

      await expect(service.generateEmbedding('test text')).rejects.toThrow(
        'API Error',
      );
    });
  });

  describe('generateEmbeddingBatch', () => {
    it('should generate batch embeddings', async () => {
      const batchResponse = {
        embeddings: [mockEmbedding, mockEmbedding],
        model: 'dengcao/Qwen3-Embedding-8B:Q4_K_M',
        dimension: 384,
        count: 2,
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(of({ data: batchResponse } as any));

      const result = await service.generateEmbeddingBatch([
        'text1',
        'text2',
      ]);

      expect(result).toEqual([mockEmbedding, mockEmbedding]);
      expect(httpService.post).toHaveBeenCalledWith(
        'http://embeddings-service:8001/api/embeddings/generate/batch',
        {
          texts: ['text1', 'text2'],
          model: 'dengcao/Qwen3-Embedding-8B:Q4_K_M',
        },
      );
    });
  });

  describe('generateAndStoreEmbedding', () => {
    it('should generate and store embedding for note', async () => {
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(of({ data: mockEmbeddingResponse } as any));
      jest.spyOn(noteEmbeddingRepository, 'upsert').mockResolvedValue({} as any);

      await service.generateAndStoreEmbedding('note-id', 'test content');

      expect(httpService.post).toHaveBeenCalled();
      expect(noteEmbeddingRepository.upsert).toHaveBeenCalledWith(
        'note-id',
        mockEmbedding,
        'dengcao/Qwen3-Embedding-8B:Q4_K_M',
      );
    });

    it('should throw error when generation fails', async () => {
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(throwError(() => new Error('Generation failed')));

      await expect(
        service.generateAndStoreEmbedding('note-id', 'test content'),
      ).rejects.toThrow('Generation failed');
    });
  });

  describe('deleteEmbedding', () => {
    it('should delete embedding by note ID', async () => {
      jest
        .spyOn(noteEmbeddingRepository, 'deleteByNoteId')
        .mockResolvedValue();

      await service.deleteEmbedding('note-id');

      expect(noteEmbeddingRepository.deleteByNoteId).toHaveBeenCalledWith(
        'note-id',
      );
    });
  });

  describe('checkHealth', () => {
    it('should return true when service is healthy', async () => {
      jest.spyOn(httpService, 'get').mockReturnValue(
        of({
          data: {
            status: 'healthy',
            model: 'dengcao/Qwen3-Embedding-8B:Q4_K_M',
            device: 'cuda',
            dimension: 384,
          },
        } as any),
      );

      const result = await service.checkHealth();

      expect(result).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(throwError(() => new Error('Service down')));

      const result = await service.checkHealth();

      expect(result).toBe(false);
    });
  });
});
