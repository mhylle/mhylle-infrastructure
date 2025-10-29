import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockRedisInstance = {
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  };

  return {
    __esModule: true,
    default: jest.fn(() => mockRedisInstance),
  };
});

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'redis.host': 'localhost',
        'redis.port': 6379,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);

    // Initialize the service (calls onModuleInit)
    await service.onModuleInit();
  });

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish messages', async () => {
    const channel = 'test-channel';
    const data = { message: 'test' };

    await expect(service.publish(channel, data)).resolves.not.toThrow();
  });
});
