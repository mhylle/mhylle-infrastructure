import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  GenerateEmbeddingDto,
  GenerateEmbeddingBatchDto,
  EmbeddingResponseDto,
  EmbeddingBatchResponseDto,
} from '../dto/embedding.dto';
import { NoteEmbeddingRepository } from '../repositories/note-embedding.repository';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly embeddingsApiUrl: string;
  private readonly defaultModel = 'all-MiniLM-L6-v2';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly noteEmbeddingRepository: NoteEmbeddingRepository,
  ) {
    this.embeddingsApiUrl =
      this.configService.get<string>('EMBEDDINGS_API_URL') ||
      'http://embeddings-service:8001';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const dto: GenerateEmbeddingDto = {
        text,
        model: this.defaultModel,
      };

      const response = await firstValueFrom(
        this.httpService.post<EmbeddingResponseDto>(
          `${this.embeddingsApiUrl}/api/embeddings/generate`,
          dto,
        ),
      );

      this.logger.log(
        `Generated embedding for text (length: ${text.length}), dimension: ${response.data.dimension}`,
      );

      return response.data.embedding;
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    try {
      const dto: GenerateEmbeddingBatchDto = {
        texts,
        model: this.defaultModel,
      };

      const response = await firstValueFrom(
        this.httpService.post<EmbeddingBatchResponseDto>(
          `${this.embeddingsApiUrl}/api/embeddings/generate/batch`,
          dto,
        ),
      );

      this.logger.log(
        `Generated ${response.data.count} embeddings, dimension: ${response.data.dimension}`,
      );

      return response.data.embeddings;
    } catch (error) {
      this.logger.error(
        `Failed to generate batch embeddings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateAndStoreEmbedding(
    noteId: string,
    text: string,
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(text);

      await this.noteEmbeddingRepository.upsert(
        noteId,
        embedding,
        this.defaultModel,
      );

      this.logger.log(`Stored embedding for note ${noteId}`);
    } catch (error) {
      this.logger.error(
        `Failed to generate and store embedding for note ${noteId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteEmbedding(noteId: string): Promise<void> {
    try {
      await this.noteEmbeddingRepository.deleteByNoteId(noteId);
      this.logger.log(`Deleted embeddings for note ${noteId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete embeddings for note ${noteId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.embeddingsApiUrl}/health`),
      );
      return response.data.status === 'healthy';
    } catch (error) {
      this.logger.warn(`Embeddings service health check failed: ${error.message}`);
      return false;
    }
  }
}
