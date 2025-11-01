import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Note } from '@shared/entities/note.entity';
import { RelationshipsService } from './relationships.service';

interface WikiLink {
  text: string;
  startIndex: number;
}

@Injectable()
export class WikiLinkParserService {
  private readonly logger = new Logger(WikiLinkParserService.name);

  constructor(
    @InjectRepository(Note)
    private readonly notesRepo: Repository<Note>,
    private readonly relationshipsService: RelationshipsService,
  ) {}

  /**
   * Parse [[wiki-style]] links from note content
   */
  parseWikiLinks(content: string): WikiLink[] {
    const regex = /\[\[([^\]]+)\]\]/g;
    const links: WikiLink[] = [];

    let match;
    while ((match = regex.exec(content)) !== null) {
      links.push({
        text: match[1].trim(),
        startIndex: match.index,
      });
    }

    this.logger.debug(`Parsed ${links.length} wiki links from content`);
    return links;
  }

  /**
   * Resolve wiki link text to actual notes using fuzzy matching
   */
  async resolveLinks(linkTexts: string[]): Promise<Note[]> {
    const resolvedNotes: Note[] = [];

    for (const text of linkTexts) {
      try {
        // Try exact match first
        let note = await this.notesRepo.findOne({
          where: {
            content: ILike(`%${text}%`),
          },
        });

        // If no exact match, try case-insensitive partial match
        if (!note) {
          note = await this.notesRepo
            .createQueryBuilder('note')
            .where('LOWER(note.content) LIKE LOWER(:text)', { text: `%${text}%` })
            .getOne();
        }

        if (note) {
          resolvedNotes.push(note);
          this.logger.debug(`Resolved link "${text}" to note ${note.id.substring(0, 8)}`);
        } else {
          this.logger.debug(`Could not resolve link "${text}" to any note`);
        }
      } catch (error) {
        this.logger.warn(`Failed to resolve link "${text}": ${error.message}`);
      }
    }

    return resolvedNotes;
  }

  /**
   * Create bidirectional referential links between notes
   */
  async createBidirectionalLinks(sourceNoteId: string, targetNoteId: string): Promise<void> {
    // Prevent self-referential links
    if (sourceNoteId === targetNoteId) {
      this.logger.debug('Skipping self-referential link');
      return;
    }

    const metadata = {
      manual: true,
      linkType: 'wiki',
      createdAt: new Date().toISOString(),
    };

    // Forward link
    await this.relationshipsService.upsert(
      sourceNoteId,
      targetNoteId,
      'referential',
      1.0,
      metadata,
    );

    // Backward link (backlink)
    await this.relationshipsService.upsert(
      targetNoteId,
      sourceNoteId,
      'referential',
      1.0,
      { ...metadata, backlink: true },
    );

    this.logger.debug(
      `Created bidirectional links between ${sourceNoteId.substring(0, 8)} and ${targetNoteId.substring(0, 8)}`,
    );
  }

  /**
   * Process all wiki links in a note and create relationships
   */
  async processNoteLinks(noteId: string, content: string): Promise<number> {
    const links = this.parseWikiLinks(content);

    if (links.length === 0) {
      return 0;
    }

    this.logger.log(`Processing ${links.length} wiki links for note ${noteId.substring(0, 8)}`);

    const linkTexts = links.map((l) => l.text);
    const targetNotes = await this.resolveLinks(linkTexts);

    let createdCount = 0;
    for (const target of targetNotes) {
      try {
        await this.createBidirectionalLinks(noteId, target.id);
        createdCount += 2; // Forward + backward
      } catch (error) {
        this.logger.warn(
          `Failed to create links between ${noteId} and ${target.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Created ${createdCount} relationships from ${targetNotes.length} resolved links`,
    );

    return createdCount;
  }

  /**
   * Batch process all notes to detect and create wiki link relationships
   */
  async processAllNotes(): Promise<{ processed: number; created: number }> {
    this.logger.log('Processing wiki links for all notes...');

    const notes = await this.notesRepo.find();
    let processedCount = 0;
    let createdCount = 0;

    for (const note of notes) {
      try {
        const created = await this.processNoteLinks(note.id, note.content);
        createdCount += created;
        processedCount++;
      } catch (error) {
        this.logger.error(`Failed to process note ${note.id}: ${error.message}`);
      }
    }

    this.logger.log(
      `Wiki link processing completed. Processed ${processedCount} notes, created ${createdCount} relationships`,
    );

    return { processed: processedCount, created: createdCount };
  }
}
