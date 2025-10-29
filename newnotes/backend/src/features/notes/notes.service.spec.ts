import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotesService } from './notes.service';
import { Note } from '@shared/entities/note.entity';
import { RedisService } from '@core/redis/redis.service';
import { CreateNoteDto } from '@shared/dto/create-note.dto';
import { NoteCreatedEvent } from '@shared/events/note-created.event';

describe('NotesService', () => {
  let service: NotesService;
  let repository: Repository<Note>;
  let redisService: RedisService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockRedisService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: getRepositoryToken(Note),
          useValue: mockRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
    repository = module.get<Repository<Note>>(getRepositoryToken(Note));
    redisService = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a note and publish event', async () => {
      const createNoteDto: CreateNoteDto = {
        content: 'Test Content',
        raw_content: 'Test Raw Content',
        metadata: { userId: 'user-123', tags: ['test'] },
        source: 'text',
      };

      const savedNote = {
        id: 'note-123',
        content: createNoteDto.content,
        raw_content: createNoteDto.raw_content,
        metadata: createNoteDto.metadata,
        source: createNoteDto.source,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.create.mockReturnValue(savedNote);
      mockRepository.save.mockResolvedValue(savedNote);

      const result = await service.create(createNoteDto);

      expect(result).toEqual(savedNote);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createNoteDto,
        raw_content: createNoteDto.raw_content,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(savedNote);

      // Verify event was published
      expect(mockRedisService.publish).toHaveBeenCalledWith(
        'notes:created',
        expect.objectContaining({
          noteId: savedNote.id,
          content: savedNote.content,
        }),
      );

      const publishedEvent = mockRedisService.publish.mock.calls[0][1];
      expect(publishedEvent).toBeInstanceOf(NoteCreatedEvent);
    });
  });
});
