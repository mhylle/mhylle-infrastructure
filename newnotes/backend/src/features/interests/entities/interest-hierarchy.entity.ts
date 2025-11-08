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

@Entity('interest_hierarchies')
@Check('"parent_id" != "child_id"')
@Index(['parentId'])
@Index(['childId'])
@Index(['parentId', 'childId'], { unique: true })
export class InterestHierarchy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'parent_id' })
  parentId: string;

  @ManyToOne(() => UserInterest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: UserInterest;

  @Column('uuid', { name: 'child_id' })
  childId: string;

  @ManyToOne(() => UserInterest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_id' })
  child: UserInterest;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'hierarchy_type',
    default: 'parent-child',
  })
  hierarchyType: string;

  @Column('decimal', {
    precision: 5,
    scale: 4,
  })
  confidence: number;

  @CreateDateColumn({ type: 'timestamp', name: 'detected_at' })
  detectedAt: Date;
}
