import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { UserInterest } from './user-interest.entity';

@Entity('interest_embeddings')
@Index(['interestId'], { unique: true })
export class InterestEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'interest_id' })
  interestId: string;

  @ManyToOne(() => UserInterest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'interest_id' })
  interest: UserInterest;

  @Column('vector', { length: 4096 })
  embedding: number[];

  @Column({ type: 'varchar', length: 50, name: 'model_version', default: 'qwen3-embedding-8b' })
  modelVersion: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
