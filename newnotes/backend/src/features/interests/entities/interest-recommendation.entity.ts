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

@Entity('interest_recommendations')
@Index(['sourceInterestId'])
@Index(['recommendationScore'])
@Index(['expiresAt'])
@Index(['sourceInterestId', 'recommendedTopic'], { unique: true })
export class InterestRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'source_interest_id' })
  sourceInterestId: string;

  @ManyToOne(() => UserInterest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_interest_id' })
  sourceInterest: UserInterest;

  @Column({ type: 'varchar', length: 255, name: 'recommended_topic' })
  recommendedTopic: string;

  @Column('decimal', {
    precision: 5,
    scale: 4,
    name: 'recommendation_score',
  })
  recommendationScore: number;

  @Column({ type: 'text', nullable: true })
  reasoning: string;

  @Column('decimal', {
    precision: 5,
    scale: 4,
    name: 'co_occurrence_score',
    default: 0,
  })
  coOccurrenceScore: number;

  @Column('decimal', {
    precision: 5,
    scale: 4,
    name: 'semantic_score',
    default: 0,
  })
  semanticScore: number;

  @Column('decimal', {
    precision: 5,
    scale: 4,
    name: 'hierarchy_score',
    default: 0,
  })
  hierarchyScore: number;

  @Column('decimal', {
    precision: 5,
    scale: 4,
    name: 'temporal_score',
    default: 0,
  })
  temporalScore: number;

  @CreateDateColumn({ type: 'timestamp', name: 'computed_at' })
  computedAt: Date;

  @Column({ type: 'timestamp', name: 'expires_at', nullable: true })
  expiresAt: Date;
}
