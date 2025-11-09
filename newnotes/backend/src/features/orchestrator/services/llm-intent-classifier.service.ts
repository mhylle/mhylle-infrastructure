import { Injectable, Logger } from '@nestjs/common';
import { LocalModelService } from '@features/llm-service/services/local-model.service';
import { IntentClassification } from '../types/intent.types';
import { INTENT_CLASSIFICATION_PROMPT } from '../prompts/intent-classification.prompt';

interface SessionContext {
  recentMessages: Array<{ role: string; content: string }>;
}

@Injectable()
export class LLMIntentClassifierService {
  private readonly logger = new Logger(LLMIntentClassifierService.name);

  constructor(private readonly localModelService: LocalModelService) {}

  async classify(
    message: string,
    context: SessionContext,
  ): Promise<IntentClassification> {
    try {
      const prompt = INTENT_CLASSIFICATION_PROMPT(message, context.recentMessages);

      const response = await this.localModelService.generateCompletion({
        prompt,
        config: {
          temperature: 0.1, // Low temperature for consistent classification
          maxTokens: 512,
        },
      });

      return this.parseClassificationResponse(response.text);
    } catch (error) {
      this.logger.error(
        `LLM classification failed: ${error.message}`,
        error.stack,
      );
      // Fallback to conversational with low confidence
      return {
        intent: 'conversational',
        confidence: 0.3,
        requires_clarification: true,
        clarification_questions: ['Could you rephrase that?'],
      };
    }
  }

  private parseClassificationResponse(responseText: string): IntentClassification {
    try {
      // Clean response (remove <think> tags, extract JSON)
      const cleaned = this.cleanJsonResponse(responseText);
      const parsed = JSON.parse(cleaned);

      // Validate required fields
      if (!parsed.intent || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid classification structure');
      }

      return {
        intent: parsed.intent,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        requires_clarification: parsed.requires_clarification || false,
        clarification_questions: parsed.clarification_questions || [],
        suggested_search_scope: parsed.suggested_search_scope,
      };
    } catch (error) {
      this.logger.error(`Failed to parse classification: ${error.message}`);
      this.logger.debug(`Response text: ${responseText.substring(0, 500)}`);

      // Return fallback
      return {
        intent: 'conversational',
        confidence: 0.3,
        requires_clarification: true,
      };
    }
  }

  private cleanJsonResponse(text: string): string {
    let cleaned = text.trim();

    // Remove <think>...</think> tags
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');

    // Extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return cleaned.trim();
  }
}
