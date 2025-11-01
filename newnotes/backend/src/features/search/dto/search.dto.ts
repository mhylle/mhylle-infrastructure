import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export enum SearchMode {
  SEMANTIC = 'semantic',
  KEYWORD = 'keyword',
  HYBRID = 'hybrid',
}

export class SearchQueryDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsEnum(SearchMode)
  mode?: SearchMode = SearchMode.HYBRID;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number = 0.0;
}

export class SearchResultDto {
  id: string;
  title: string;
  content: string;
  snippet: string;
  score: number;
  searchType: 'semantic' | 'keyword' | 'hybrid';
  createdAt: Date;
  updatedAt: Date;
}

export class SearchResponseDto {
  results: SearchResultDto[];
  query: string;
  mode: SearchMode;
  totalResults: number;
  processingTimeMs: number;
}
