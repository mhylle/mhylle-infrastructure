import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Check,
} from 'typeorm';
import { UserInterest } from './user-interest.entity';

@Entity('interest_similarities')
@Check('"interest_1_id" < "interest_2_id"')
@Index(['interest1Id'])
@Index(['interest2Id'])
@Index(['similarityScore'])
@Index(['interest1Id', 'interest2Id'], { unique: true })
export class InterestSimilarity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'interest_1_id' })
  interest1Id: string;

  @ManyToOne(() => UserInterest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'interest_1_id' })
  interest1: UserInterest;

  @Column('uuid', { name: 'interest_2_id' })
  interest2Id: string;

  @ManyToOne(() => UserInterest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'interest_2_id' })
  interest2: UserInterest;

  @Column('decimal', {
    precision: 5,
    scale: 4,
    name: 'similarity_score',
  })
  similarityScore: number;

  @CreateDateColumn({ type: 'timestamp', name: 'computed_at' })
  computedAt: Date;
}
