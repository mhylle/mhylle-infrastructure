import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NoteEmbedding } from '../entities/note-embedding.entity';

@Injectable()
export class NoteEmbeddingRepository {
  constructor(
    @InjectRepository(NoteEmbedding)
    private readonly repository: Repository<NoteEmbedding>,
  ) {}

  async save(
    noteId: string,
    embedding: number[],
    model: string,
  ): Promise<NoteEmbedding> {
    const noteEmbedding = this.repository.create({
      noteId,
      embedding,
      model,
    });

    return this.repository.save(noteEmbedding);
  }

  async findByNoteId(noteId: string): Promise<NoteEmbedding[]> {
    return this.repository.find({
      where: { noteId },
    });
  }

  async findByNoteIdAndModel(
    noteId: string,
    model: string,
  ): Promise<NoteEmbedding | null> {
    return this.repository.findOne({
      where: { noteId, model },
    });
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    await this.repository.delete({ noteId });
  }

  async upsert(
    noteId: string,
    embedding: number[],
    model: string,
  ): Promise<NoteEmbedding> {
    const existing = await this.findByNoteIdAndModel(noteId, model);

    if (existing) {
      existing.embedding = embedding;
      return this.repository.save(existing);
    }

    return this.save(noteId, embedding, model);
  }
}
