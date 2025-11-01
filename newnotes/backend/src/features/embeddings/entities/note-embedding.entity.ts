import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Note } from '../../notes/entities/note.entity';

@Entity('note_embeddings')
@Index(['noteId', 'model'], { unique: true })
export class NoteEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  noteId: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'noteId' })
  note: Note;

  @Column({
    type: 'vector',
    length: 384, // all-MiniLM-L6-v2 dimension
  })
  embedding: number[];

  @Column({ length: 100 })
  model: string;

  @CreateDateColumn()
  createdAt: Date;
}
