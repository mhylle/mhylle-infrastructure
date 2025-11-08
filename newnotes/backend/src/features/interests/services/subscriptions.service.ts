import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicSubscription } from '../entities/topic-subscription.entity';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(TopicSubscription)
    private subscriptionsRepo: Repository<TopicSubscription>,
  ) {}

  async findAll(): Promise<TopicSubscription[]> {
    return await this.subscriptionsRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findActive(): Promise<TopicSubscription[]> {
    return await this.subscriptionsRepo.find({
      where: { enabled: true },
      order: { topic: 'ASC' },
    });
  }

  async findOne(id: string): Promise<TopicSubscription> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { id },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }
    return subscription;
  }

  async create(dto: CreateSubscriptionDto): Promise<TopicSubscription> {
    // Check if topic already exists
    const existing = await this.subscriptionsRepo.findOne({
      where: { topic: dto.topic },
    });

    if (existing) {
      throw new ConflictException(
        `Subscription for topic "${dto.topic}" already exists`,
      );
    }

    const subscription = this.subscriptionsRepo.create({
      topic: dto.topic,
      notificationFrequency: dto.notificationFrequency || 'daily',
      isAutoDetected: dto.isAutoDetected || false,
      confirmed: true, // Manual subscriptions are confirmed by default
      enabled: true,
    });

    const saved = await this.subscriptionsRepo.save(subscription);
    this.logger.log(`Created subscription: ${saved.topic}`);
    return saved;
  }

  async confirmInterest(
    interestId: string,
    topic: string,
  ): Promise<TopicSubscription> {
    // Check if subscription already exists
    const existing = await this.subscriptionsRepo.findOne({
      where: { topic },
    });

    if (existing) {
      // Update existing subscription
      existing.confirmed = true;
      existing.isAutoDetected = true;
      const updated = await this.subscriptionsRepo.save(existing);
      this.logger.log(`Confirmed existing subscription: ${topic}`);
      return updated;
    }

    // Create new subscription from detected interest
    const subscription = this.subscriptionsRepo.create({
      topic,
      isAutoDetected: true,
      confirmed: true,
      notificationFrequency: 'daily',
      enabled: true,
    });

    const saved = await this.subscriptionsRepo.save(subscription);
    this.logger.log(`Confirmed auto-detected interest as subscription: ${topic}`);
    return saved;
  }

  async update(
    id: string,
    dto: UpdateSubscriptionDto,
  ): Promise<TopicSubscription> {
    const subscription = await this.findOne(id);

    if (dto.notificationFrequency) {
      subscription.notificationFrequency = dto.notificationFrequency;
    }

    if (dto.enabled !== undefined) {
      subscription.enabled = dto.enabled;
    }

    const updated = await this.subscriptionsRepo.save(subscription);
    this.logger.log(`Updated subscription: ${updated.topic}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const subscription = await this.findOne(id);
    await this.subscriptionsRepo.remove(subscription);
    this.logger.log(`Deleted subscription: ${subscription.topic}`);
  }

  async updateLastFetch(id: string): Promise<void> {
    await this.subscriptionsRepo.update(id, {
      lastFetch: new Date(),
    });
    this.logger.log(`Updated last fetch time for subscription: ${id}`);
  }

  async findByTopic(topic: string): Promise<TopicSubscription | null> {
    return await this.subscriptionsRepo.findOne({ where: { topic } });
  }
}
