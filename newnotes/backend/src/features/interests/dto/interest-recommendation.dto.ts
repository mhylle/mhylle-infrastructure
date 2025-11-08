import { IsString, IsNumber, IsUUID, IsObject, Min, Max } from 'class-validator';

export class SignalBreakdownDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  coOccurrence: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  semanticSimilarity: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  hierarchy: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  temporal: number;
}

export class InterestRecommendationDto {
  @IsUUID()
  interestId: string;

  @IsString()
  topic: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  score: number;

  @IsObject()
  signals: SignalBreakdownDto;

  @IsString()
  reasoning: string;
}

export class RecommendationsRequestDto {
  @IsUUID()
  sourceInterestId: string;

  @IsNumber()
  limit?: number = 10;

  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number = 0.3;
}

export class RecommendationsResponseDto {
  @IsUUID()
  sourceInterestId: string;

  @IsString()
  sourceTopic: string;

  recommendations: InterestRecommendationDto[];

  @IsNumber()
  totalCount: number;

  @IsString()
  cacheHit: boolean;
}
