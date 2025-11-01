import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Note } from '@shared/entities/note.entity';

@Entity('note_relationships')
@Index(['sourceNoteId', 'targetNoteId', 'relationshipType'], { unique: true })
@Index(['sourceNoteId'])
@Index(['targetNoteId'])
@Index(['confidence'])
@Index(['relationshipType'])
export class NoteRelationship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_note_id', type: 'uuid' })
  sourceNoteId: string;

  @Column({ name: 'target_note_id', type: 'uuid' })
  targetNoteId: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_note_id' })
  sourceNote: Note;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_note_id' })
  targetNote: Note;

  @Column({
    name: 'relationship_type',
    type: 'varchar',
    length: 50,
  })
  relationshipType: 'semantic' | 'referential' | 'causal' | 'temporal';

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  confidence: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
