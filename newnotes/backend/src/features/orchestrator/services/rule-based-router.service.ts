import { Injectable, Logger } from '@nestjs/common';
import { IntentClassification, RoutingRule } from '../types/intent.types';
import { ROUTING_RULES } from '../config/routing-rules.config';

@Injectable()
export class RuleBasedRouterService {
  private readonly logger = new Logger(RuleBasedRouterService.name);

  /**
   * Route message using rule-based pattern matching
   * Returns null if no confident match found (confidence < 0.7)
   */
  route(message: string): IntentClassification | null {
    const normalizedMessage = message.toLowerCase().trim();
    const CONFIDENCE_THRESHOLD = 0.7;

    // Sort rules by priority (highest first)
    const sortedRules = [...ROUTING_RULES].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const score = this.calculateMatchScore(normalizedMessage, rule);

      if (score > 0) {
        const finalConfidence = rule.confidence * score;

        // Only return if confidence is above threshold
        if (finalConfidence >= CONFIDENCE_THRESHOLD) {
          this.logger.debug(
            `Rule match: "${message}" -> ${rule.intent} (score: ${score}, confidence: ${finalConfidence})`,
          );

          return {
            intent: rule.intent,
            confidence: finalConfidence,
            requires_clarification: false,
          };
        }
      }
    }

    this.logger.debug(`No rule match for: "${message}"`);
    return null;
  }

  /**
   * Calculate match score for a rule (0.0-1.0)
   * Returns 0 if no match, or a score indicating match quality
   */
  private calculateMatchScore(message: string, rule: RoutingRule): number {
    // Check negative keywords first (disqualifying)
    if (rule.patterns.negativeKeywords) {
      for (const negativeKeyword of rule.patterns.negativeKeywords) {
        if (message.includes(negativeKeyword.toLowerCase())) {
          return 0; // Disqualified
        }
      }
    }

    let hasKeywordMatch = false;
    let hasRegexMatch = false;

    // Check keywords - any match counts
    if (rule.patterns.keywords && rule.patterns.keywords.length > 0) {
      hasKeywordMatch = rule.patterns.keywords.some((keyword) =>
        message.includes(keyword.toLowerCase()),
      );
    }

    // Check regex patterns - any match counts
    if (rule.patterns.regex && rule.patterns.regex.length > 0) {
      hasRegexMatch = rule.patterns.regex.some((regex) => regex.test(message));
    }

    // If no patterns are defined, no match
    const hasPatternsToCheck =
      (rule.patterns.keywords && rule.patterns.keywords.length > 0) ||
      (rule.patterns.regex && rule.patterns.regex.length > 0);

    if (!hasPatternsToCheck) {
      return 0;
    }

    // Require at least one match
    if (!hasKeywordMatch && !hasRegexMatch) {
      return 0;
    }

    // Calculate confidence multiplier based on match quality
    // Both keyword and regex match = 1.0 (full confidence)
    // Either keyword or regex match = 0.95 (slight reduction)
    const bothTypesPresent =
      (rule.patterns.keywords && rule.patterns.keywords.length > 0) &&
      (rule.patterns.regex && rule.patterns.regex.length > 0);

    if (bothTypesPresent) {
      // If both types are defined, require at least one from each for full confidence
      return (hasKeywordMatch && hasRegexMatch) ? 1.0 : 0.95;
    } else {
      // If only one type is defined, any match gives full confidence
      return 1.0;
    }
  }
}
