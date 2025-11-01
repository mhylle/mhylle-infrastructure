import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WikiLinkParserService } from '../services/wiki-link-parser.service';

export class NoteSavedEvent {
  noteId: string;
  content: string;
}

@Injectable()
export class NoteRelationshipListener {
  private readonly logger = new Logger(NoteRelationshipListener.name);

  constructor(private readonly wikiLinkParser: WikiLinkParserService) {}

  @OnEvent('note.saved')
  async handleNoteSaved(event: NoteSavedEvent) {
    this.logger.log(`Processing wiki links for note ${event.noteId.substring(0, 8)}`);

    try {
      await this.wikiLinkParser.processNoteLinks(event.noteId, event.content);
    } catch (error) {
      this.logger.error(
        `Failed to process wiki links for note ${event.noteId}: ${error.message}`,
      );
    }
  }

  @OnEvent('note.created')
  async handleNoteCreated(event: NoteSavedEvent) {
    // Same processing as saved
    await this.handleNoteSaved(event);
  }

  @OnEvent('note.updated')
  async handleNoteUpdated(event: NoteSavedEvent) {
    // Same processing as saved
    await this.handleNoteSaved(event);
  }
}
