import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NoteRelationship } from '../entities/note-relationship.entity';
import { Note } from '@shared/entities/note.entity';

@Injectable()
export class RelationshipsService {
  private readonly logger = new Logger(RelationshipsService.name);

  constructor(
    @InjectRepository(NoteRelationship)
    private readonly relationshipsRepo: Repository<NoteRelationship>,
    @InjectRepository(Note)
    private readonly notesRepo: Repository<Note>,
  ) {}

  async create(
    sourceNoteId: string,
    targetNoteId: string,
    relationshipType: 'semantic' | 'referential' | 'causal' | 'temporal',
    confidence: number,
    metadata?: Record<string, any>,
  ): Promise<NoteRelationship> {
    const relationship = this.relationshipsRepo.create({
      sourceNoteId,
      targetNoteId,
      relationshipType,
      confidence,
      metadata,
    });

    return this.relationshipsRepo.save(relationship);
  }

  async upsert(
    sourceNoteId: string,
    targetNoteId: string,
    relationshipType: 'semantic' | 'referential' | 'causal' | 'temporal',
    confidence: number,
    metadata?: Record<string, any>,
  ): Promise<NoteRelationship> {
    const existing = await this.relationshipsRepo.findOne({
      where: {
        sourceNoteId,
        targetNoteId,
        relationshipType,
      },
    });

    if (existing) {
      existing.confidence = confidence;
      existing.metadata = metadata || existing.metadata;
      return this.relationshipsRepo.save(existing);
    }

    return this.create(sourceNoteId, targetNoteId, relationshipType, confidence, metadata);
  }

  async getForNote(noteId: string): Promise<NoteRelationship[]> {
    return this.relationshipsRepo.find({
      where: [{ sourceNoteId: noteId }, { targetNoteId: noteId }],
      order: {
        confidence: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async getRelatedNotes(noteId: string): Promise<Array<Note & { relationship: any }>> {
    const relationships = await this.relationshipsRepo
      .createQueryBuilder('rel')
      .where('rel.source_note_id = :noteId', { noteId })
      .leftJoinAndSelect('rel.targetNote', 'targetNote')
      .orderBy('rel.confidence', 'DESC')
      .addOrderBy('rel.created_at', 'DESC')
      .getMany();

    return relationships.map((rel) => ({
      ...rel.targetNote,
      relationship: {
        id: rel.id,
        type: rel.relationshipType,
        confidence: rel.confidence,
        metadata: rel.metadata,
      },
    }));
  }

  async delete(relationshipId: string): Promise<void> {
    const result = await this.relationshipsRepo.delete(relationshipId);

    if (result.affected === 0) {
      throw new NotFoundException(`Relationship with ID ${relationshipId} not found`);
    }
  }

  async deleteForNote(noteId: string): Promise<void> {
    await this.relationshipsRepo.delete({
      sourceNoteId: noteId,
    });

    await this.relationshipsRepo.delete({
      targetNoteId: noteId,
    });
  }

  async findByType(
    noteId: string,
    relationshipType: 'semantic' | 'referential' | 'causal' | 'temporal',
  ): Promise<NoteRelationship[]> {
    return this.relationshipsRepo.find({
      where: {
        sourceNoteId: noteId,
        relationshipType,
      },
      order: {
        confidence: 'DESC',
      },
    });
  }

  async count(): Promise<number> {
    return this.relationshipsRepo.count();
  }

  async getStats() {
    const total = await this.count();

    const byType = await this.relationshipsRepo
      .createQueryBuilder('rel')
      .select('rel.relationship_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('rel.relationship_type')
      .getRawMany();

    const avgConfidence = await this.relationshipsRepo
      .createQueryBuilder('rel')
      .select('AVG(rel.confidence)', 'avg')
      .getRawOne();

    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count, 10);
        return acc;
      }, {}),
      averageConfidence: parseFloat(avgConfidence.avg || '0'),
    };
  }
}
