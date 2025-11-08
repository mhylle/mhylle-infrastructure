import { IsString, IsNumber, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO representing a node in the interest hierarchy tree
 * Used for GET /api/interests/hierarchy endpoint
 */
export class InterestHierarchyNodeDto {
  @IsUUID()
  id: string;

  @IsString()
  topic: string;

  @IsNumber()
  confidence: number;

  @IsNumber()
  evidenceCount: number;

  @IsNumber()
  depth: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterestHierarchyNodeDto)
  children: InterestHierarchyNodeDto[];
}

/**
 * DTO representing a node in the interest path (ancestors or descendants)
 * Used for GET /api/interests/:id/descendants and GET /api/interests/:id/ancestors endpoints
 */
export class InterestPathNodeDto {
  @IsUUID()
  id: string;

  @IsString()
  topic: string;

  @IsNumber()
  confidence: number;

  @IsNumber()
  evidenceCount: number;

  @IsNumber()
  depth: number;
}

/**
 * Response DTO for hierarchy endpoint
 */
export class InterestHierarchyResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterestHierarchyNodeDto)
  roots: InterestHierarchyNodeDto[];

  @IsNumber()
  totalInterests: number;

  @IsNumber()
  totalLevels: number;
}

/**
 * Response DTO for descendants endpoint
 */
export class InterestDescendantsResponseDto {
  @IsUUID()
  interestId: string;

  @IsString()
  topic: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterestPathNodeDto)
  descendants: InterestPathNodeDto[];

  @IsNumber()
  totalCount: number;

  @IsNumber()
  maxDepth: number;
}

/**
 * Response DTO for ancestors endpoint
 */
export class InterestAncestorsResponseDto {
  @IsUUID()
  interestId: string;

  @IsString()
  topic: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterestPathNodeDto)
  ancestors: InterestPathNodeDto[];

  @IsNumber()
  totalCount: number;

  @IsNumber()
  maxDepth: number;
}
