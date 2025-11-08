import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InterestEvidence } from './interest-evidence.entity';

@Entity('user_interests')
@Index(['mergedIntoId'])
@Index(['isActive'])
export class UserInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  topic: string;

  @Column('decimal', { precision: 3, scale: 2 })
  confidence: number;

  @Column({ name: 'source_type', length: 50 })
  sourceType: string;

  @Column({ name: 'evidence_count', default: 1 })
  evidenceCount: number;

  @Column({ name: 'last_seen', type: 'timestamp', default: () => 'NOW()' })
  lastSeen: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => InterestEvidence, (evidence) => evidence.interest)
  evidence: InterestEvidence[];

  @Column('uuid', { name: 'merged_into_id', nullable: true })
  mergedIntoId?: string;

  @ManyToOne(() => UserInterest, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'merged_into_id' })
  mergedInto?: UserInterest;

  @Column('text', { array: true, default: '{}' })
  synonyms: string[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
