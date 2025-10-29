import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { Note } from '@shared/entities/note.entity';
import { RedisModule } from '@core/redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Note]), RedisModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
