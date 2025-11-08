import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserInterest } from './user-interest.entity';

@Entity('interest_evidence')
export class InterestEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'interest_id' })
  interestId: string;

  @ManyToOne(() => UserInterest, (interest) => interest.evidence)
  @JoinColumn({ name: 'interest_id' })
  interest: UserInterest;

  @Column({ name: 'source_id' })
  sourceId: string;

  @Column({ name: 'source_type', length: 50 })
  sourceType: string;

  @Column('decimal', { name: 'relevance_score', precision: 3, scale: 2 })
  relevanceScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
