import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotesService } from '../src/features/notes/notes.service';
import { EmbeddingsService } from '../src/features/embeddings/services/embeddings.service';

async function bootstrap() {
  console.log('Starting direct embeddings backfill...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const notesService = app.get(NotesService);
  const embeddingsService = app.get(EmbeddingsService);

  try {
    // Get all notes
    const notes = await notesService.findAll();
    console.log(`Found ${notes.length} notes in database`);

    // Generate embedding for each note directly
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const note of notes) {
      processedCount++;
      try {
        console.log(`[${processedCount}/${notes.length}] Processing note ${note.id}...`);

        const text = note.raw_content || note.content;
        await embeddingsService.generateAndStoreEmbedding(note.id, text);

        successCount++;
        console.log(`✓ Generated embedding for: "${note.content.substring(0, 50)}..."`);
      } catch (error) {
        failedCount++;
        console.error(`✗ Failed for note ${note.id}: ${error.message}`);
      }
    }

    console.log(`\nBackfill complete:`);
    console.log(`  Total: ${notes.length}`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failedCount}`);
  } catch (error) {
    console.error('Backfill failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
