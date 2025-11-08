import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { TopicSubscription } from '../entities/topic-subscription.entity';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let repo: Repository<TopicSubscription>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(TopicSubscription),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    repo = module.get<Repository<TopicSubscription>>(
      getRepositoryToken(TopicSubscription),
    );

    // Clear all mocks between tests
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all subscriptions ordered by createdAt DESC', async () => {
      const subs = [
        { id: '1', topic: 'AI', createdAt: new Date() },
        { id: '2', topic: 'ML', createdAt: new Date() },
      ];
      mockRepository.find.mockResolvedValue(subs);

      const result = await service.findAll();

      expect(result).toEqual(subs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findActive', () => {
    it('should return only active subscriptions', async () => {
      const activeSubs = [
        { id: '1', topic: 'AI', enabled: true },
        { id: '2', topic: 'ML', enabled: true },
      ];
      mockRepository.find.mockResolvedValue(activeSubs);

      const result = await service.findActive();

      expect(result).toEqual(activeSubs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
        order: { topic: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a subscription by id', async () => {
      const subscription = { id: '1', topic: 'AI' };
      mockRepository.findOne.mockResolvedValue(subscription);

      const result = await service.findOne('1');

      expect(result).toEqual(subscription);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new subscription', async () => {
      const dto = { topic: 'Machine Learning' };
      const subscription = {
        id: '1',
        topic: 'Machine Learning',
        enabled: true,
        confirmed: true,
        notificationFrequency: 'daily',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(subscription);
      mockRepository.save.mockResolvedValue(subscription);

      const result = await service.create(dto);

      expect(result).toEqual(subscription);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { topic: dto.topic },
      });
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(subscription);
    });

    it('should throw ConflictException if topic already exists', async () => {
      const dto = { topic: 'AI' };
      mockRepository.findOne.mockResolvedValue({ id: '1', topic: 'AI' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should use provided notification frequency', async () => {
      const dto = {
        topic: 'Deep Learning',
        notificationFrequency: 'weekly',
      };
      const subscription = {
        id: '1',
        ...dto,
        enabled: true,
        confirmed: true,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(subscription);
      mockRepository.save.mockResolvedValue(subscription);

      const result = await service.create(dto);

      expect(result.notificationFrequency).toBe('weekly');
    });
  });

  describe('confirmInterest', () => {
    it('should update existing subscription when topic exists', async () => {
      const existing = {
        id: '1',
        topic: 'AI',
        confirmed: false,
        isAutoDetected: false,
      };
      const updated = { ...existing, confirmed: true, isAutoDetected: true };

      mockRepository.findOne.mockResolvedValue(existing);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.confirmInterest('interest-1', 'AI');

      expect(result.confirmed).toBe(true);
      expect(result.isAutoDetected).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(existing);
    });

    it('should create new subscription when topic does not exist', async () => {
      const subscription = {
        id: '1',
        topic: 'Neural Networks',
        isAutoDetected: true,
        confirmed: true,
        notificationFrequency: 'daily',
        enabled: true,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(subscription);
      mockRepository.save.mockResolvedValue(subscription);

      const result = await service.confirmInterest(
        'interest-1',
        'Neural Networks',
      );

      expect(result).toEqual(subscription);
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update subscription notification frequency', async () => {
      const subscription = {
        id: '1',
        topic: 'AI',
        notificationFrequency: 'daily',
        enabled: true,
      };
      const dto = { notificationFrequency: 'weekly' };

      mockRepository.findOne.mockResolvedValue(subscription);
      mockRepository.save.mockResolvedValue({
        ...subscription,
        notificationFrequency: 'weekly',
      });

      const result = await service.update('1', dto);

      expect(result.notificationFrequency).toBe('weekly');
    });

    it('should update subscription enabled status', async () => {
      const subscription = {
        id: '1',
        topic: 'AI',
        notificationFrequency: 'daily',
        enabled: true,
      };
      const dto = { enabled: false };

      mockRepository.findOne.mockResolvedValue(subscription);
      mockRepository.save.mockResolvedValue({
        ...subscription,
        enabled: false,
      });

      const result = await service.update('1', dto);

      expect(result.enabled).toBe(false);
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('999', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete a subscription', async () => {
      const subscription = { id: '1', topic: 'AI' };
      mockRepository.findOne.mockResolvedValue(subscription);
      mockRepository.remove.mockResolvedValue(subscription);

      await service.delete('1');

      expect(mockRepository.remove).toHaveBeenCalledWith(subscription);
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLastFetch', () => {
    it('should update last fetch timestamp', async () => {
      await service.updateLastFetch('1');

      expect(mockRepository.update).toHaveBeenCalledWith('1', {
        lastFetch: expect.any(Date),
      });
    });
  });

  describe('findByTopic', () => {
    it('should find subscription by topic', async () => {
      const subscription = { id: '1', topic: 'AI' };
      mockRepository.findOne.mockResolvedValue(subscription);

      const result = await service.findByTopic('AI');

      expect(result).toEqual(subscription);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { topic: 'AI' },
      });
    });

    it('should return null if topic not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByTopic('NonExistent');

      expect(result).toBeNull();
    });
  });
});
