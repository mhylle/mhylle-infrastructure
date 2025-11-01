import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmbeddingsService } from '@features/embeddings/services/embeddings.service';
import {
  SearchQueryDto,
  SearchResultDto,
  SearchResponseDto,
  SearchMode,
} from '../dto/search.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async search(queryDto: SearchQueryDto): Promise<SearchResponseDto> {
    const startTime = Date.now();

    let results: SearchResultDto[];

    switch (queryDto.mode) {
      case SearchMode.SEMANTIC:
        results = await this.semanticSearch(
          queryDto.query,
          queryDto.limit,
          queryDto.minScore,
        );
        break;
      case SearchMode.KEYWORD:
        results = await this.keywordSearch(
          queryDto.query,
          queryDto.limit,
          queryDto.minScore,
        );
        break;
      case SearchMode.HYBRID:
      default:
        results = await this.hybridSearch(
          queryDto.query,
          queryDto.limit,
          queryDto.minScore,
        );
        break;
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      results,
      query: queryDto.query,
      mode: queryDto.mode || SearchMode.HYBRID,
      totalResults: results.length,
      processingTimeMs,
    };
  }

  private async semanticSearch(
    query: string,
    limit: number = 10,
    minScore: number = 0.0,
  ): Promise<SearchResultDto[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingsService.generateEmbedding(
        query,
      );

      // Perform vector similarity search using pgvector
      const results = await this.dataSource.query(
        `
        SELECT
          n.id,
          n.title,
          n.content,
          SUBSTRING(n.content, 1, 200) as snippet,
          1 - (ne.embedding <=> $1::vector) as score,
          n.created_at as "createdAt",
          n.updated_at as "updatedAt"
        FROM notes n
        JOIN note_embeddings ne ON n.id = ne."noteId"
        WHERE ne.model = 'all-MiniLM-L6-v2'
          AND (1 - (ne.embedding <=> $1::vector)) >= $2
        ORDER BY ne.embedding <=> $1::vector
        LIMIT $3
      `,
        [queryEmbedding, minScore, limit],
      );

      return results.map((r) => ({
        ...r,
        searchType: 'semantic' as const,
      }));
    } catch (error) {
      this.logger.error(
        `Semantic search failed: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  private async keywordSearch(
    query: string,
    limit: number = 10,
    minScore: number = 0.0,
  ): Promise<SearchResultDto[]> {
    try {
      // Use PostgreSQL full-text search
      const results = await this.dataSource.query(
        `
        SELECT
          n.id,
          n.title,
          n.content,
          ts_headline('english', n.content, plainto_tsquery('english', $1),
            'MaxWords=50, MinWords=25') as snippet,
          ts_rank(
            to_tsvector('english', n.title || ' ' || n.content),
            plainto_tsquery('english', $1)
          ) as score,
          n.created_at as "createdAt",
          n.updated_at as "updatedAt"
        FROM notes n
        WHERE
          to_tsvector('english', n.title || ' ' || n.content) @@
          plainto_tsquery('english', $1)
          AND ts_rank(
            to_tsvector('english', n.title || ' ' || n.content),
            plainto_tsquery('english', $1)
          ) >= $2
        ORDER BY score DESC
        LIMIT $3
      `,
        [query, minScore, limit],
      );

      return results.map((r) => ({
        ...r,
        searchType: 'keyword' as const,
      }));
    } catch (error) {
      this.logger.error(
        `Keyword search failed: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  private async hybridSearch(
    query: string,
    limit: number = 10,
    minScore: number = 0.0,
  ): Promise<SearchResultDto[]> {
    try {
      // Run both searches in parallel
      const [semanticResults, keywordResults] = await Promise.all([
        this.semanticSearch(query, limit * 2, 0), // Get more results for merging
        this.keywordSearch(query, limit * 2, 0),
      ]);

      // Combine and deduplicate results
      const combinedResults = new Map<string, SearchResultDto>();

      // Weight semantic results (70% weight)
      semanticResults.forEach((result) => {
        combinedResults.set(result.id, {
          ...result,
          score: result.score * 0.7,
          searchType: 'hybrid' as const,
        });
      });

      // Add keyword results (30% weight)
      keywordResults.forEach((result) => {
        const existing = combinedResults.get(result.id);
        if (existing) {
          // Combine scores if note appears in both results
          existing.score += result.score * 0.3;
          // Use keyword snippet (usually better highlighted)
          existing.snippet = result.snippet;
        } else {
          combinedResults.set(result.id, {
            ...result,
            score: result.score * 0.3,
            searchType: 'hybrid' as const,
          });
        }
      });

      // Sort by combined score and apply filters
      const results = Array.from(combinedResults.values())
        .filter((r) => r.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return results;
    } catch (error) {
      this.logger.error(
        `Hybrid search failed: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }
}
