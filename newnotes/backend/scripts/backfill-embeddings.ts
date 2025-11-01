import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotesService } from '../src/features/notes/notes.service';
import { RedisService } from '../src/core/redis/redis.service';

async function bootstrap() {
  console.log('Starting embeddings backfill...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const notesService = app.get(NotesService);
  const redisService = app.get(RedisService);

  try {
    // Get all notes
    const notes = await notesService.findAll();
    console.log(`Found ${notes.length} notes in database`);

    // Publish NOTE_CREATED event for each note to trigger embedding generation
    let publishedCount = 0;
    for (const note of notes) {
      try {
        await redisService.publish('note.created', {
          noteId: note.id,
          content: note.content,
          rawContent: note.raw_content || note.content,
          source: note.source || 'text',
          metadata: {
            userId: 'system',
            createdAt: note.created_at,
          },
          timestamp: new Date(),
        });
        publishedCount++;
        console.log(`✓ Published event for note ${note.id}: "${note.content.substring(0, 50)}..."`);
      } catch (error) {
        console.error(`✗ Failed to publish event for note ${note.id}:`, error.message);
      }
    }

    console.log(`\nBackfill complete: Published ${publishedCount}/${notes.length} events`);
    console.log('Embeddings will be generated asynchronously by the embeddings service.');
    console.log('Wait 30-60 seconds for all embeddings to be generated.');
  } catch (error) {
    console.error('Backfill failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
