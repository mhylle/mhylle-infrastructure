import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('topic_subscriptions')
export class TopicSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  topic: string;

  @Column({ name: 'is_auto_detected', default: false })
  isAutoDetected: boolean;

  @Column({ default: false })
  confirmed: boolean;

  @Column({ name: 'notification_frequency', length: 50, default: 'daily' })
  notificationFrequency: string; // 'daily', 'weekly', 'real-time'

  @Column({ name: 'last_fetch', type: 'timestamp', nullable: true })
  lastFetch: Date | null;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
