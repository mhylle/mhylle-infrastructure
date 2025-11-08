import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageSavedEvent } from '../../chat/events/chat-message-saved.event';
import { InterestDetectionService } from '../services/interest-detection.service';
import { ChatMessage } from '../../chat/entities/chat-message.entity';

/**
 * Listener for chat message events that triggers interest detection.
 * Phase 5: Triggers detection on EVERY message after 5 total messages exist.
 * Implements throttling to avoid excessive LLM calls (max 1 per 30 seconds).
 */
@Injectable()
export class ChatInterestListener {
  private readonly logger = new Logger(ChatInterestListener.name);
  private lastDetectionTime: Date | null = null;
  private readonly THROTTLE_SECONDS = 30;
  private readonly MIN_MESSAGES_THRESHOLD = 5;
  private cachedMessageCount = 0;
  private lastCountUpdate: Date | null = null;

  constructor(
    private readonly interestDetectionService: InterestDetectionService,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
  ) {}

  @OnEvent('chat.message.saved', { async: true })
  async handleChatMessage(event: ChatMessageSavedEvent): Promise<void> {
    this.logger.debug(`Chat message saved: ${event.messageId}`);

    // Increment cached count (optimistic)
    this.cachedMessageCount++;

    // Refresh from database every 10 messages or if stale (>1 minute)
    const shouldRefreshCount =
      this.cachedMessageCount % 10 === 0 ||
      !this.lastCountUpdate ||
      Date.now() - this.lastCountUpdate.getTime() > 60000;

    if (shouldRefreshCount) {
      const actualCount = await this.messageRepository.count();
      this.cachedMessageCount = actualCount;
      this.lastCountUpdate = new Date();
      this.logger.debug(`Refreshed message count from database: ${actualCount}`);
    }

    console.log('🟢 LISTENER RECEIVED EVENT: chat.message.saved', {
      messageId: event.messageId,
      role: event.role,
      sessionId: event.sessionId,
      totalMessages: this.cachedMessageCount,
      threshold: this.MIN_MESSAGES_THRESHOLD,
    });

    // Don't detect until we have at least 5 messages
    if (this.cachedMessageCount < this.MIN_MESSAGES_THRESHOLD) {
      this.logger.debug(
        `Only ${this.cachedMessageCount} messages in system. Waiting for ${this.MIN_MESSAGES_THRESHOLD} before detection.`,
      );
      console.log(
        `⏸️  DETECTION SKIPPED: Only ${this.cachedMessageCount}/${this.MIN_MESSAGES_THRESHOLD} messages`,
      );
      return;
    }

    // Check throttling (max 1 detection per 30 seconds)
    if (this.lastDetectionTime) {
      const secondsSinceLastDetection =
        (Date.now() - this.lastDetectionTime.getTime()) / 1000;

      if (secondsSinceLastDetection < this.THROTTLE_SECONDS) {
        const waitTime = this.THROTTLE_SECONDS - secondsSinceLastDetection;
        this.logger.debug(
          `Throttled: Last detection was ${secondsSinceLastDetection.toFixed(1)}s ago. ` +
            `Waiting ${waitTime.toFixed(1)}s more.`,
        );
        console.log(
          `⏱️  THROTTLED: Last detection ${secondsSinceLastDetection.toFixed(1)}s ago, need to wait ${waitTime.toFixed(1)}s more`,
        );
        return;
      }
    }

    // Update last detection time
    this.lastDetectionTime = new Date();
    console.log('✅ TRIGGERING DETECTION: Threshold met and not throttled');

    // Run detection asynchronously (non-blocking)
    this.runInterestDetection(event.sessionId).catch((error) => {
      this.logger.error('Failed to analyze chat for interests:', error);
      // Don't throw - this should never block chat
    });
  }

  private async runInterestDetection(sessionId: string): Promise<void> {
    console.log('🚀 STARTING INTEREST DETECTION', {
      sessionId,
      reason: 'message threshold reached',
      threshold: this.MIN_MESSAGES_THRESHOLD,
      totalMessages: this.cachedMessageCount,
    });

    this.logger.log(
      `Running interest detection for session ${sessionId} (message threshold reached)`,
    );

    try {
      // Get recent messages from this session
      const recentMessages = await this.messageRepository.find({
        where: { sessionId },
        order: { createdAt: 'DESC' },
        take: 20, // Analyze last 20 messages from session
      });

      if (recentMessages.length === 0) {
        this.logger.warn('No messages found for interest detection');
        return;
      }

      this.logger.debug(
        `Analyzing ${recentMessages.length} messages from session`,
      );

      // Build interest map
      const interests = new Map();

      // Concatenate message content
      const chatText = recentMessages
        .map((m) => m.content)
        .reverse() // Restore chronological order
        .join('\n\n');

      // Use the same extraction logic as InterestDetectionService
      // Note: We're not directly calling analyzeChatMessages because it queries all messages
      // Instead, we'll trigger the full detection which includes all sources
      await this.interestDetectionService.detectInterests();

      this.logger.log('Interest detection completed successfully');
    } catch (error) {
      this.logger.error('Interest detection failed:', error);
      throw error;
    }
  }
}
