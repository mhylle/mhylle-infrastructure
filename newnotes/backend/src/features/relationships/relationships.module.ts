import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NoteRelationship } from './entities/note-relationship.entity';
import { Note } from '@shared/entities/note.entity';
import { NoteEmbedding } from '@features/embeddings/entities/note-embedding.entity';
import { RelationshipsService } from './services/relationships.service';
import { SimilarityDetectionService } from './services/similarity-detection.service';
import { WikiLinkParserService } from './services/wiki-link-parser.service';
import { RelationshipsMigrationService } from './services/relationships-migration.service';
import { RelationshipsController } from './controllers/relationships.controller';
import { NoteRelationshipListener } from './listeners/note-relationship.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([NoteRelationship, Note, NoteEmbedding]),
    ScheduleModule.forRoot(),
  ],
  controllers: [RelationshipsController],
  providers: [
    RelationshipsService,
    SimilarityDetectionService,
    WikiLinkParserService,
    RelationshipsMigrationService,
    NoteRelationshipListener,
  ],
  exports: [
    RelationshipsService,
    SimilarityDetectionService,
    WikiLinkParserService,
  ],
})
export class RelationshipsModule {}
