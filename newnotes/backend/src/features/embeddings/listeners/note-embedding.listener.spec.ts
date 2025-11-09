import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '@core/redis/redis.service';
import { NoteEmbeddingListener } from './note-embedding.listener';
import { EmbeddingsService } from '../services/embeddings.service';
import { NOTE_EVENTS } from '@features/events/schemas/note-events.schema';
import { NoteCreatedEvent } from '@shared/events/note-created.event';

describe('NoteEmbeddingListener', () => {
  let listener: NoteEmbeddingListener;
  let redisService: RedisService;
  let embeddingsService: EmbeddingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoteEmbeddingListener,
        {
          provide: RedisService,
          useValue: {
            subscribe: jest.fn(),
          },
        },
        {
          provide: EmbeddingsService,
          useValue: {
            generateAndStoreEmbedding: jest.fn(),
          },
        },
      ],
    }).compile();

    listener = module.get<NoteEmbeddingListener>(NoteEmbeddingListener);
    redisService = module.get<RedisService>(RedisService);
    embeddingsService = module.get<EmbeddingsService>(EmbeddingsService);
  });

  describe('onModuleInit', () => {
    it('should subscribe to NOTE_CREATED event', async () => {
      await listener.onModuleInit();

      expect(redisService.subscribe).toHaveBeenCalledWith(
        NOTE_EVENTS.NOTE_CREATED,
        expect.any(Function),
      );
    });

    it('should handle subscription errors gracefully', async () => {
      jest
        .spyOn(redisService, 'subscribe')
        .mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(listener.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('handleNoteCreated', () => {
    let handleNoteCreated: (data: any) => Promise<void>;

    beforeEach(async () => {
      await listener.onModuleInit();
      handleNoteCreated = (redisService.subscribe as jest.Mock).mock
        .calls[0][1];
    });

    it('should generate and store embedding for valid event', async () => {
      const event: NoteCreatedEvent = {
        noteId: 'test-note-id',
        content: 'Test content for embedding',
        rawContent: 'Test content for embedding',
        source: 'api',
        metadata: {
          userId: 'user-1',
          createdAt: new Date(),
        },
        timestamp: new Date(),
      };

      jest
        .spyOn(embeddingsService, 'generateAndStoreEmbedding')
        .mockResolvedValue();

      await handleNoteCreated(event);

      expect(
        embeddingsService.generateAndStoreEmbedding,
      ).toHaveBeenCalledWith('test-note-id', 'Test content for embedding');
    });

    it('should use content if rawContent is missing', async () => {
      const event: NoteCreatedEvent = {
        noteId: 'test-note-id',
        content: 'Fallback content',
        rawContent: 'Fallback content',
        source: 'api',
        metadata: {
          userId: 'user-1',
          createdAt: new Date(),
        },
        timestamp: new Date(),
      };

      jest
        .spyOn(embeddingsService, 'generateAndStoreEmbedding')
        .mockResolvedValue();

      await handleNoteCreated(event);

      expect(
        embeddingsService.generateAndStoreEmbedding,
      ).toHaveBeenCalledWith('test-note-id', 'Fallback content');
    });

    it('should handle missing noteId gracefully', async () => {
      const event = {
        content: 'Test content',
      } as any;

      await handleNoteCreated(event);

      expect(
        embeddingsService.generateAndStoreEmbedding,
      ).not.toHaveBeenCalled();
    });

    it('should handle embedding generation errors gracefully', async () => {
      const event: NoteCreatedEvent = {
        noteId: 'test-note-id',
        content: 'Test content',
        rawContent: 'Test content',
        source: 'api',
        metadata: {
          userId: 'user-1',
          createdAt: new Date(),
        },
        timestamp: new Date(),
      };

      jest
        .spyOn(embeddingsService, 'generateAndStoreEmbedding')
        .mockRejectedValue(new Error('Embedding generation failed'));

      // Should not throw
      await expect(handleNoteCreated(event)).resolves.not.toThrow();
    });
  });
});
