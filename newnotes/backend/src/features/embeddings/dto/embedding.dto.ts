export class GenerateEmbeddingDto {
  text: string;
  model?: string;
}

export class GenerateEmbeddingBatchDto {
  texts: string[];
  model?: string;
}

export class EmbeddingResponseDto {
  embedding: number[];
  model: string;
  dimension: number;
}

export class EmbeddingBatchResponseDto {
  embeddings: number[][];
  model: string;
  dimension: number;
  count: number;
}
