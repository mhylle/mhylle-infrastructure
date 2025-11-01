import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { SearchService } from '../services/search.service';
import {
  SearchQueryDto,
  SearchResponseDto,
  SearchMode,
} from '../dto/search.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('semantic')
  async semanticSearch(
    @Query(ValidationPipe) queryDto: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    return this.searchService.search({
      ...queryDto,
      mode: SearchMode.SEMANTIC,
    });
  }

  @Get('keyword')
  async keywordSearch(
    @Query(ValidationPipe) queryDto: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    return this.searchService.search({
      ...queryDto,
      mode: SearchMode.KEYWORD,
    });
  }

  @Get()
  async search(
    @Query(ValidationPipe) queryDto: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    return this.searchService.search(queryDto);
  }
}
