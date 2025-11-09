import { Injectable, Logger } from '@nestjs/common';
import { IntentClassification } from '../types/intent.types';

interface MetricLog {
  timestamp: Date;
  message: string;
  intent: string;
  confidence: number;
  routing_method: 'rule' | 'llm';
  processing_time_ms: number;
}

@Injectable()
export class OrchestratorMetricsService {
  private readonly logger = new Logger(OrchestratorMetricsService.name);
  private metrics: MetricLog[] = [];

  log(data: {
    message: string;
    intent: IntentClassification;
    routing_method: 'rule' | 'llm';
    processing_time_ms: number;
  }): void {
    const metric: MetricLog = {
      timestamp: new Date(),
      message: data.message.substring(0, 100),
      intent: data.intent.intent,
      confidence: data.intent.confidence,
      routing_method: data.routing_method,
      processing_time_ms: data.processing_time_ms,
    };

    this.metrics.push(metric);

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    this.logger.debug(
      `[${data.routing_method}] ${data.intent.intent} (${data.intent.confidence.toFixed(2)}) - ${data.processing_time_ms}ms`,
    );
  }

  getMetrics(): {
    total: number;
    rule_percentage: number;
    llm_percentage: number;
    avg_rule_time_ms: number;
    avg_llm_time_ms: number;
    intent_distribution: Record<string, number>;
  } {
    const total = this.metrics.length;
    const ruleCount = this.metrics.filter((m) => m.routing_method === 'rule').length;
    const llmCount = this.metrics.filter((m) => m.routing_method === 'llm').length;

    const ruleTimes = this.metrics
      .filter((m) => m.routing_method === 'rule')
      .map((m) => m.processing_time_ms);
    const llmTimes = this.metrics
      .filter((m) => m.routing_method === 'llm')
      .map((m) => m.processing_time_ms);

    const intentCounts = this.metrics.reduce(
      (acc, m) => {
        acc[m.intent] = (acc[m.intent] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      rule_percentage: (ruleCount / total) * 100,
      llm_percentage: (llmCount / total) * 100,
      avg_rule_time_ms:
        ruleTimes.length > 0
          ? ruleTimes.reduce((a, b) => a + b, 0) / ruleTimes.length
          : 0,
      avg_llm_time_ms:
        llmTimes.length > 0
          ? llmTimes.reduce((a, b) => a + b, 0) / llmTimes.length
          : 0,
      intent_distribution: intentCounts,
    };
  }

  reset(): void {
    this.metrics = [];
  }
}
