import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('redis.host') || 'localhost';
    const port = this.configService.get<number>('redis.port') || 6379;

    this.logger.log(`Connecting to Redis at ${host}:${port}`);

    this.client = new Redis({
      host,
      port,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Retrying Redis connection, attempt ${times}`);
        return delay;
      },
    });

    this.subscriber = new Redis({
      host,
      port,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis client error: ${err.message}`);
    });

    this.subscriber.on('error', (err) => {
      this.logger.error(`Redis subscriber error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting Redis clients');
    await this.client?.quit();
    await this.subscriber?.quit();
  }

  async publish(channel: string, data: any): Promise<void> {
    try {
      const message = JSON.stringify(data);
      await this.client.publish(channel, message);
      this.logger.debug(`Published to ${channel}: ${message}`);
    } catch (error) {
      this.logger.error(`Failed to publish to ${channel}: ${error.message}`);
      throw error;
    }
  }

  async subscribe(
    channel: string,
    handler: (data: any) => void,
  ): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            const data = JSON.parse(message);
            handler(data);
          } catch (error) {
            this.logger.error(`Failed to parse message: ${error.message}`);
          }
        }
      });
      this.logger.log(`Subscribed to ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${channel}: ${error.message}`);
      throw error;
    }
  }
}
