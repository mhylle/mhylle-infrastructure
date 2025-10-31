import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from '@shared/entities/note.entity';
import { CreateNoteDto } from '@shared/dto/create-note.dto';
import { UpdateNoteDto } from '@shared/dto/update-note.dto';
import { RedisService } from '@core/redis/redis.service';
import { NoteCreatedEvent } from '@shared/events/note-created.event';
import { NOTE_EVENTS } from '@features/events/schemas/note-events.schema';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private notesRepository: Repository<Note>,
    private redisService: RedisService,
  ) {}

  async create(createNoteDto: CreateNoteDto): Promise<Note> {
    const note = this.notesRepository.create({
      ...createNoteDto,
      raw_content: createNoteDto.raw_content || createNoteDto.content,
    });
    const savedNote = await this.notesRepository.save(note);

    // Publish NoteCreatedEvent
    try {
      const event = new NoteCreatedEvent({
        noteId: savedNote.id,
        content: savedNote.content,
        rawContent: savedNote.raw_content,
        source: savedNote.source || 'api',
        metadata: {
          userId: savedNote.metadata?.userId || 'unknown',
          createdAt: savedNote.created_at,
          tags: savedNote.metadata?.tags,
        },
        timestamp: new Date(),
      });

      await this.redisService.publish(NOTE_EVENTS.NOTE_CREATED, event);
    } catch (error) {
      // Log error but don't fail note creation
      console.error('Failed to publish NOTE_CREATED event:', error);
    }

    return savedNote;
  }

  async findAll(): Promise<Note[]> {
    return this.notesRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Note> {
    const note = await this.notesRepository.findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }
    return note;
  }

  async update(id: string, updateNoteDto: UpdateNoteDto): Promise<Note> {
    const note = await this.findOne(id);
    Object.assign(note, updateNoteDto);
    return this.notesRepository.save(note);
  }

  async remove(id: string): Promise<void> {
    const note = await this.findOne(id);
    await this.notesRepository.remove(note);
  }
}
