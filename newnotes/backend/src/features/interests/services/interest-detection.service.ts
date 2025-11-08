import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { UserInterest } from '../entities/user-interest.entity';
import { InterestEvidence } from '../entities/interest-evidence.entity';
import { Note } from '../../../shared/entities/note.entity';
import { LocalModelService } from '../../llm-service/services/local-model.service';
import { InterestSimilarityService } from './interest-similarity.service';
import { InterestHierarchyService } from './interest-hierarchy.service';

interface TopicResult {
  name: string;
  score: number;
  count: number;
}

interface InterestData {
  topic: string;
  confidence: number;
  sourceType: string;
  evidenceCount: number;
  lastSeen: Date;
}

@Injectable()
export class InterestDetectionService {
  private readonly logger = new Logger(InterestDetectionService.name);

  constructor(
    @InjectRepository(UserInterest)
    private readonly interestsRepo: Repository<UserInterest>,
    @InjectRepository(InterestEvidence)
    private readonly evidenceRepo: Repository<InterestEvidence>,
    @InjectRepository(Note)
    private readonly notesRepo: Repository<Note>,
    private readonly dataSource: DataSource,
    private readonly localModelService: LocalModelService,
    @Inject(forwardRef(() => InterestSimilarityService))
    private readonly similarityService: InterestSimilarityService,
    @Inject(forwardRef(() => InterestHierarchyService))
    private readonly hierarchyService: InterestHierarchyService,
  ) {}

  async detectInterests(): Promise<UserInterest[]> {
    this.logger.log('Starting interest detection...');
    const interests = new Map<string, InterestData>();

    try {
      // Analyze notes
      await this.analyzeNotes(interests);

      // Analyze tasks
      await this.analyzeTasks(interests);

      // Analyze chat messages
      await this.analyzeChatMessages(interests);

      // Log all detected interests with their confidence scores
      this.logger.debug('All detected interests before filtering:');
      Array.from(interests.values()).forEach((interest) => {
        this.logger.debug(
          `  - ${interest.topic}: confidence=${interest.confidence.toFixed(3)}, source=${interest.sourceType}`,
        );
      });

      // Filter and save interests
      const detectedInterests = Array.from(interests.values()).filter(
        (i) => i.confidence >= 0.6,
      );

      this.logger.log(
        `Detected ${detectedInterests.length} interests above threshold`,
      );

      const savedInterests = await this.saveInterests(detectedInterests);

      // Generate embeddings and auto-merge similar interests
      this.logger.log('Generating embeddings for new interests...');
      for (const interest of savedInterests) {
        try {
          await this.similarityService.generateInterestEmbedding(interest);
        } catch (error) {
          this.logger.error(
            `Failed to generate embedding for interest ${interest.topic}:`,
            error,
          );
        }
      }

      // Auto-merge similar interests
      this.logger.log('Auto-merging similar interests...');
      try {
        await this.similarityService.autoMergeSimilarInterests(0.85);
      } catch (error) {
        this.logger.error('Failed to auto-merge similar interests:', error);
      }

      // Detect hierarchical relationships
      this.logger.log('Detecting interest hierarchies...');
      try {
        await this.hierarchyService.detectHierarchies();
      } catch (error) {
        this.logger.error('Failed to detect hierarchies:', error);
      }

      return savedInterests;
    } catch (error) {
      this.logger.error('Interest detection failed:', error);
      throw error;
    }
  }

  private async analyzeNotes(
    interests: Map<string, InterestData>,
  ): Promise<void> {
    this.logger.log('Analyzing notes for interests...');

    try {
      const recentNotes = await this.notesRepo.find({
        order: { created_at: 'DESC' },
        take: 100,
      });

      if (recentNotes.length === 0) {
        this.logger.log('No notes found to analyze');
        return;
      }

      this.logger.log(`Analyzing ${recentNotes.length} notes...`);

      // Concatenate note content
      const notesText = recentNotes.map((n) => n.content).join('\n\n');

      // Extract topics using LLM
      const topics = await this.extractTopicsFromText(notesText);

      // Update interests map
      for (const topic of topics) {
        const existing = interests.get(topic.name);
        if (existing) {
          existing.confidence = Math.min(
            1.0,
            existing.confidence + topic.score,
          );
          existing.evidenceCount += topic.count;
          existing.lastSeen = new Date();
        } else {
          interests.set(topic.name, {
            topic: topic.name,
            confidence: topic.score,
            sourceType: 'notes',
            evidenceCount: topic.count,
            lastSeen: new Date(),
          });
        }
      }

      this.logger.log(`Extracted ${topics.length} topics from notes`);
    } catch (error) {
      this.logger.error('Failed to analyze notes:', error);
      // Continue execution - don't fail the entire detection
    }
  }

  private async analyzeTasks(
    interests: Map<string, InterestData>,
  ): Promise<void> {
    this.logger.log('Analyzing tasks for interests...');

    try {
      const tasks = await this.dataSource.query(`
        SELECT id, title FROM tasks ORDER BY created_at DESC LIMIT 100
      `);

      if (tasks.length === 0) {
        this.logger.log('No tasks found to analyze');
        return;
      }

      this.logger.log(`Analyzing ${tasks.length} tasks...`);

      // Concatenate task titles
      const tasksText = tasks.map((t: any) => t.title).join('\n');

      // Extract topics using LLM
      const topics = await this.extractTopicsFromText(tasksText);

      // Update interests map with lower weight for tasks
      for (const topic of topics) {
        const existing = interests.get(topic.name);
        if (existing) {
          // Boost existing interests by 20%
          existing.confidence = Math.min(
            1.0,
            existing.confidence + topic.score * 0.2,
          );
          existing.evidenceCount += topic.count;
          existing.lastSeen = new Date();
        } else {
          // New interests from tasks get 40% weight
          interests.set(topic.name, {
            topic: topic.name,
            confidence: topic.score * 0.4,
            sourceType: 'tasks',
            evidenceCount: topic.count,
            lastSeen: new Date(),
          });
        }
      }

      this.logger.log(`Extracted ${topics.length} topics from tasks`);
    } catch (error) {
      this.logger.error('Failed to analyze tasks:', error);
      // Continue execution - don't fail the entire detection
    }
  }

  private async analyzeChatMessages(
    interests: Map<string, InterestData>,
  ): Promise<void> {
    this.logger.log('Analyzing chat messages for interests...');

    try {
      const messages = await this.dataSource.query(`
        SELECT id, content, role FROM chat_messages
        ORDER BY created_at DESC
        LIMIT 100
      `);

      if (messages.length === 0) {
        this.logger.log('No chat messages found to analyze');
        return;
      }

      this.logger.log(`Analyzing ${messages.length} chat messages...`);

      // Concatenate message content (both user and assistant messages)
      const chatText = messages.map((m: any) => m.content).join('\n\n');

      // Extract topics using LLM
      const topics = await this.extractTopicsFromText(chatText);

      // Update interests map with moderate weight for chat (0.6 - between notes and tasks)
      for (const topic of topics) {
        const existing = interests.get(topic.name);
        if (existing) {
          // Boost existing interests by 30%
          existing.confidence = Math.min(
            1.0,
            existing.confidence + topic.score * 0.3,
          );
          existing.evidenceCount += topic.count;
          existing.lastSeen = new Date();
        } else {
          // New interests from chat get 70% weight
          interests.set(topic.name, {
            topic: topic.name,
            confidence: topic.score * 0.7,
            sourceType: 'chat',
            evidenceCount: topic.count,
            lastSeen: new Date(),
          });
        }
      }

      this.logger.log(`Extracted ${topics.length} topics from chat messages`);
    } catch (error) {
      this.logger.error('Failed to analyze chat messages:', error);
      // Continue execution - don't fail the entire detection
    }
  }

  private async extractTopicsFromText(text: string): Promise<TopicResult[]> {
    // Limit text length for LLM processing
    const limitedText = text.substring(0, 8000);

    const prompt = `Analyze the following text and extract the main topics or interests. Return a JSON array of topics with their relevance scores (0-1) and frequency.

Text:
${limitedText}

Return format: [{"name": "topic name", "score": 0.8, "count": 3}]`;

    try {
      this.logger.debug('Calling LLM for topic extraction...');

      const response = await this.localModelService.generateCompletion({
        prompt,
        systemPrompt:
          'You are a helpful assistant that extracts topics from text. Return only valid JSON arrays.',
        config: {
          temperature: 0.3, // Lower temperature for more consistent output
          maxTokens: 1000,
        },
      });

      // Try to parse JSON response
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('No JSON array found in LLM response');
        return [];
      }

      const topics = JSON.parse(jsonMatch[0]) as TopicResult[];

      // Validate and sanitize results
      return topics
        .filter(
          (t) =>
            t.name &&
            typeof t.score === 'number' &&
            typeof t.count === 'number',
        )
        .map((t) => ({
          name: t.name.trim(),
          score: Math.max(0, Math.min(1, t.score)), // Clamp to 0-1
          count: Math.max(1, Math.round(t.count)), // At least 1
        }));
    } catch (error) {
      this.logger.error('Failed to extract topics from text:', error);
      return [];
    }
  }

  private async saveInterests(interests: InterestData[]): Promise<UserInterest[]> {
    this.logger.log(`Saving ${interests.length} interests...`);
    const saved: UserInterest[] = [];

    for (const interest of interests) {
      try {
        const existing = await this.interestsRepo.findOne({
          where: { topic: interest.topic },
        });

        if (existing) {
          // Update existing interest
          existing.confidence = interest.confidence;
          existing.evidenceCount = interest.evidenceCount;
          existing.lastSeen = interest.lastSeen;
          existing.sourceType = interest.sourceType;
          saved.push(await this.interestsRepo.save(existing));
          this.logger.debug(`Updated interest: ${interest.topic}`);
        } else {
          // Create new interest
          const newInterest = this.interestsRepo.create(interest);
          saved.push(await this.interestsRepo.save(newInterest));
          this.logger.debug(`Created new interest: ${interest.topic}`);
        }
      } catch (error) {
        this.logger.error(`Failed to save interest ${interest.topic}:`, error);
        // Continue with other interests
      }
    }

    this.logger.log(`Successfully saved ${saved.length} interests`);
    return saved;
  }

  async getInterests(minConfidence: number = 0.7): Promise<UserInterest[]> {
    this.logger.log(`Fetching interests with confidence >= ${minConfidence}`);

    return await this.interestsRepo.find({
      where: { confidence: MoreThanOrEqual(minConfidence) },
      order: { confidence: 'DESC' },
    });
  }

  async deleteInterest(id: string): Promise<void> {
    this.logger.log(`Deleting interest with ID: ${id}`);
    await this.interestsRepo.delete(id);
  }

  async boostConfidence(topic: string, amount: number): Promise<void> {
    this.logger.log(`Boosting confidence for topic "${topic}" by ${amount}`);

    const interest = await this.interestsRepo.findOne({ where: { topic } });

    if (!interest) {
      this.logger.warn(`Interest "${topic}" not found`);
      return;
    }

    interest.confidence = Math.min(1.0, interest.confidence + amount);
    interest.lastSeen = new Date();
    await this.interestsRepo.save(interest);

    this.logger.log(
      `Updated confidence for "${topic}" to ${interest.confidence}`,
    );
  }

  async reduceConfidence(topic: string, amount: number): Promise<void> {
    this.logger.log(`Reducing confidence for topic "${topic}" by ${amount}`);

    const interest = await this.interestsRepo.findOne({ where: { topic } });

    if (!interest) {
      this.logger.warn(`Interest "${topic}" not found`);
      return;
    }

    interest.confidence = Math.max(0, interest.confidence - amount);
    interest.lastSeen = new Date();
    await this.interestsRepo.save(interest);

    this.logger.log(
      `Updated confidence for "${topic}" to ${interest.confidence}`,
    );
  }
}
