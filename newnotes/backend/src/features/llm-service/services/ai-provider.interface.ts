export interface AIProviderConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIGenerationRequest {
  prompt: string;
  config?: Partial<AIProviderConfig>;
  systemPrompt?: string;
}

export interface AIGenerationResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  metadata?: Record<string, any>;
}

export interface IAIProvider {
  generateCompletion(request: AIGenerationRequest): Promise<AIGenerationResponse>;
  healthCheck(): Promise<boolean>;
  getProviderName(): string;
  getDefaultConfig(): AIProviderConfig;
}
