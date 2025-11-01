import { Controller, Get, Post, Delete, Param, Logger } from '@nestjs/common';
import { RelationshipsService } from '../services/relationships.service';
import { SimilarityDetectionService } from '../services/similarity-detection.service';
import { WikiLinkParserService } from '../services/wiki-link-parser.service';
import {
  RelationshipResponseDto,
  RelatedNoteDto,
  DetectionResultDto,
  StatsDto,
} from '../dto/relationship-response.dto';

@Controller('notes')
export class RelationshipsController {
  private readonly logger = new Logger(RelationshipsController.name);

  constructor(
    private readonly relationshipsService: RelationshipsService,
    private readonly similarityDetectionService: SimilarityDetectionService,
    private readonly wikiLinkParserService: WikiLinkParserService,
  ) {}

  /**
   * Get all relationships for a specific note
   * GET /api/notes/:id/relationships
   */
  @Get(':id/relationships')
  async getRelationships(@Param('id') noteId: string): Promise<RelationshipResponseDto[]> {
    this.logger.log(`Getting relationships for note ${noteId.substring(0, 8)}`);
    return this.relationshipsService.getForNote(noteId);
  }

  /**
   * Get related notes with full note details
   * GET /api/notes/:id/related
   */
  @Get(':id/related')
  async getRelatedNotes(@Param('id') noteId: string): Promise<RelatedNoteDto[]> {
    this.logger.log(`Getting related notes for note ${noteId.substring(0, 8)}`);
    return this.relationshipsService.getRelatedNotes(noteId);
  }

  /**
   * Trigger similarity detection for all notes
   * POST /api/notes/relationships/detect
   */
  @Post('relationships/detect')
  async triggerSimilarityDetection(): Promise<DetectionResultDto> {
    this.logger.log('Manual trigger: similarity detection');
    const result = await this.similarityDetectionService.detectSimilarities();

    return {
      message: 'Similarity detection completed',
      processed: result.processed,
      created: result.created,
    };
  }

  /**
   * Trigger wiki link processing for all notes
   * POST /api/notes/relationships/wiki-links
   */
  @Post('relationships/wiki-links')
  async triggerWikiLinkProcessing(): Promise<DetectionResultDto> {
    this.logger.log('Manual trigger: wiki link processing');
    const result = await this.wikiLinkParserService.processAllNotes();

    return {
      message: 'Wiki link processing completed',
      processed: result.processed,
      created: result.created,
    };
  }

  /**
   * Get relationship statistics
   * GET /api/notes/relationships/stats
   */
  @Get('relationships/stats')
  async getStats(): Promise<StatsDto> {
    this.logger.log('Getting relationship statistics');
    return this.relationshipsService.getStats();
  }

  /**
   * Delete a specific relationship
   * DELETE /api/notes/relationships/:id
   */
  @Delete('relationships/:id')
  async deleteRelationship(@Param('id') relationshipId: string): Promise<{ message: string }> {
    this.logger.log(`Deleting relationship ${relationshipId.substring(0, 8)}`);
    await this.relationshipsService.delete(relationshipId);

    return { message: 'Relationship deleted successfully' };
  }
}
