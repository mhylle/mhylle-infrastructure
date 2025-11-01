import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '@core/redis/redis.service';
import { EmbeddingsService } from '../services/embeddings.service';
import { NOTE_EVENTS } from '@features/events/schemas/note-events.schema';
import { NoteCreatedEvent } from '@shared/events/note-created.event';

@Injectable()
export class NoteEmbeddingListener implements OnModuleInit {
  private readonly logger = new Logger(NoteEmbeddingListener.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing NoteEmbeddingListener');

    try {
      await this.redisService.subscribe(
        NOTE_EVENTS.NOTE_CREATED,
        this.handleNoteCreated.bind(this),
      );
      this.logger.log(
        `Subscribed to ${NOTE_EVENTS.NOTE_CREATED} channel successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to ${NOTE_EVENTS.NOTE_CREATED}: ${error.message}`,
      );
    }
  }

  private async handleNoteCreated(data: any): Promise<void> {
    try {
      const event = data as NoteCreatedEvent;

      if (!event.noteId || !event.content) {
        this.logger.warn(
          'Invalid NOTE_CREATED event: missing required fields',
        );
        return;
      }

      this.logger.log(
        `Processing note ${event.noteId} for embedding generation`,
      );

      // Combine title and content for embedding (if title exists)
      const text = event.rawContent || event.content;

      await this.embeddingsService.generateAndStoreEmbedding(
        event.noteId,
        text,
      );

      this.logger.log(
        `Successfully generated embedding for note ${event.noteId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error generating embedding for note: ${error.message}`,
        error.stack,
      );
      // Don't throw - embedding generation failure shouldn't block note creation
    }
  }
}
