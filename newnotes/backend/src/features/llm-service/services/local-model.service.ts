import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  IAIProvider,
  AIProviderConfig,
  AIGenerationRequest,
  AIGenerationResponse,
} from './ai-provider.interface';

@Injectable()
export class LocalModelService implements IAIProvider {
  private readonly logger = new Logger(LocalModelService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeout: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'ollama.baseUrl',
      'http://localhost:11434',
    );
    this.defaultModel = this.configService.get<string>(
      'ollama.defaultModel',
      'deepseek-r1:32b',
    );
    this.timeout = this.configService.get<number>('ollama.timeout', 60000);

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(
      `LocalModelService initialized: ${this.baseUrl} (model: ${this.defaultModel})`,
    );
  }

  async generateCompletion(
    request: AIGenerationRequest,
  ): Promise<AIGenerationResponse> {
    const startTime = Date.now();

    try {
      const config = { ...this.getDefaultConfig(), ...request.config };
      const model = config.model || this.defaultModel;

      const fullPrompt = this.buildPrompt(request);

      this.logger.debug(`Generating completion with model: ${model}`);

      const response = await this.httpClient.post('/api/generate', {
        model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
        },
      });

      const processingTime = Date.now() - startTime;

      this.logger.debug(`Completion generated in ${processingTime}ms`);

      return {
        text: response.data.response,
        model,
        tokensUsed: this.estimateTokens(fullPrompt, response.data.response),
        metadata: {
          processingTime,
          evalCount: response.data.eval_count,
        },
      };
    } catch (error) {
      this.logger.error(`Completion failed: ${error.message}`);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/tags', {
        timeout: 5000,
      });

      const models = response.data.models || [];
      const modelExists = models.some(
        (m: any) =>
          m.name === this.defaultModel ||
          m.name.startsWith(this.defaultModel.split(':')[0]),
      );

      if (!modelExists) {
        this.logger.warn(`Model '${this.defaultModel}' not found`);
        return false;
      }

      this.logger.debug('Ollama health check: OK');
      return true;
    } catch (error) {
      this.logger.error(`Ollama health check failed: ${error.message}`);
      return false;
    }
  }

  getProviderName(): string {
    return 'LocalModelService (Ollama)';
  }

  getDefaultConfig(): AIProviderConfig {
    return {
      model: this.defaultModel,
      temperature: 0.7,
      maxTokens: 4096,
    };
  }

  private buildPrompt(request: AIGenerationRequest): string {
    const parts: string[] = [];

    if (request.systemPrompt) {
      parts.push(`System: ${request.systemPrompt}\n`);
    }

    parts.push(`User: ${request.prompt}`);

    return parts.join('\n');
  }

  private estimateTokens(prompt: string, response: string): number {
    const totalChars = prompt.length + response.length;
    return Math.ceil(totalChars / 4);
  }
}
