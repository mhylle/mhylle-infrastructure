# Notes System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered personal note-taking system that automatically extracts tasks from notes using local Ollama LLM (DeepSeek-R1:32B).

**Architecture:** Modular monolith NestJS backend with core/features/shared structure, Angular 20 frontend, Redis Pub/Sub for event-driven communication, PostgreSQL for persistence, Ollama for AI processing.

**Tech Stack:** NestJS 11, Angular 20, TypeORM, PostgreSQL, Redis, Ollama (DeepSeek-R1:32B), Docker

**Reference:** See `docs/plans/2025-10-28-notes-system-design.md` for complete design.

---

## Phase 1: Foundation (Backend Setup + Basic API)

### Task 1.1: Initialize Backend Structure

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/nest-cli.json`
- Create: `backend/.env.example`
- Create: `backend/Dockerfile`

**Step 1: Create backend directory and package.json**

```bash
mkdir -p backend
cd backend
```

Create `backend/package.json`:
```json
{
  "name": "notes-backend",
  "version": "1.0.0",
  "description": "AI-Powered Notes System Backend",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/typeorm": "^11.0.0",
    "axios": "^1.11.0",
    "pg": "^8.16.3",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "typeorm": "^0.3.25"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.3.1",
    "eslint": "^9.18.0",
    "jest": "^30.1.3",
    "prettier": "^3.4.2",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

**Step 2: Create TypeScript configuration**

Create `backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true
  }
}
```

**Step 3: Create Nest CLI configuration**

Create `backend/nest-cli.json`:
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

**Step 4: Create environment example**

Create `backend/.env.example`:
```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=notes_db
DATABASE_USER=app_notes
DATABASE_PASSWORD=notes_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=deepseek-r1:32b
OLLAMA_TIMEOUT=60000
```

**Step 5: Create Dockerfile**

Create `backend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
```

**Step 6: Install dependencies**

Run: `npm install`
Expected: Dependencies installed successfully

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend NestJS project structure

- Add package.json with NestJS 11 dependencies
- Configure TypeScript and Nest CLI
- Create .env.example with database, Redis, Ollama config
- Add production Dockerfile with multi-stage build"
```

### Task 1.2: Create Core Configuration Module

**Files:**
- Create: `backend/src/config/configuration.ts`
- Create: `backend/src/config/config.module.ts`

**Step 1: Write configuration factory**

Create `backend/src/config/configuration.ts`:
```typescript
export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'deepseek-r1:32b',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});
```

**Step 2: Create config module**

Create `backend/src/config/config.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
  ],
})
export class ConfigModule {}
```

**Step 3: Commit**

```bash
git add backend/src/config/
git commit -m "feat: add core configuration module

- Create configuration factory with database, Ollama, Redis settings
- Setup global ConfigModule using @nestjs/config
- Support .env and .env.local file loading"
```

### Task 1.3: Setup Database Module with TypeORM

**Files:**
- Create: `backend/src/core/database/database.module.ts`
- Create: `backend/src/shared/entities/note.entity.ts`

**Step 1: Create Note entity**

Create `backend/src/shared/entities/note.entity.ts`:
```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column('text')
  raw_content: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'text' })
  source: string;
}
```

**Step 2: Create database module**

Create `backend/src/core/database/database.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Note } from '../../shared/entities/note.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [Note],
        synchronize: configService.get('environment') !== 'production',
        logging: configService.get('environment') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
```

**Step 3: Create entities barrel export**

Create `backend/src/shared/entities/index.ts`:
```typescript
export { Note } from './note.entity';
```

**Step 4: Commit**

```bash
git add backend/src/core/database/ backend/src/shared/entities/
git commit -m "feat: setup database module with TypeORM

- Create Note entity with UUID, timestamps, JSONB metadata
- Configure TypeORM with async factory using ConfigService
- Enable synchronize in development, logging for debugging"
```

### Task 1.4: Create Health Check Endpoints

**Files:**
- Create: `backend/src/core/health/health.controller.ts`
- Create: `backend/src/core/health/health.module.ts`

**Step 1: Create health controller**

Create `backend/src/core/health/health.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  healthCheck() {
    return {
      status: 'healthy',
      application: 'Notes Backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
```

**Step 2: Create health module**

Create `backend/src/core/health/health.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

**Step 3: Commit**

```bash
git add backend/src/core/health/
git commit -m "feat: add health check endpoint

- Create /health endpoint returning status, timestamp, uptime
- Follows example-app2 pattern for Docker health checks"
```

### Task 1.5: Create Notes Feature Module with Basic CRUD

**Files:**
- Create: `backend/src/features/notes/dto/create-note.dto.ts`
- Create: `backend/src/features/notes/notes.service.ts`
- Create: `backend/src/features/notes/notes.controller.ts`
- Create: `backend/src/features/notes/notes.module.ts`
- Create: `backend/src/features/notes/notes.service.spec.ts`

**Step 1: Write failing test for NotesService**

Create `backend/src/features/notes/notes.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotesService } from './notes.service';
import { Note } from '../../shared/entities/note.entity';

describe('NotesService', () => {
  let service: NotesService;
  let repository: Repository<Note>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: getRepositoryToken(Note),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
    repository = module.get<Repository<Note>>(getRepositoryToken(Note));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a note', async () => {
    const createDto = { content: 'Test note' };
    const savedNote = { id: '1', content: 'Test note', raw_content: 'Test note' };

    jest.spyOn(repository, 'create').mockReturnValue(savedNote as Note);
    jest.spyOn(repository, 'save').mockResolvedValue(savedNote as Note);

    const result = await service.create(createDto);

    expect(result).toEqual(savedNote);
    expect(repository.create).toHaveBeenCalledWith({
      content: 'Test note',
      raw_content: 'Test note',
    });
  });

  it('should find all notes', async () => {
    const notes = [{ id: '1', content: 'Note 1' }];
    jest.spyOn(repository, 'find').mockResolvedValue(notes as Note[]);

    const result = await service.findAll();

    expect(result).toEqual(notes);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- notes.service.spec.ts`
Expected: FAIL with "Cannot find module './notes.service'"

**Step 3: Create DTO**

Create `backend/src/features/notes/dto/create-note.dto.ts`:
```typescript
export class CreateNoteDto {
  content: string;
}
```

**Step 4: Create NotesService**

Create `backend/src/features/notes/notes.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from '../../shared/entities/note.entity';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly repository: Repository<Note>,
  ) {}

  async create(createNoteDto: CreateNoteDto): Promise<Note> {
    const note = this.repository.create({
      content: createNoteDto.content,
      raw_content: createNoteDto.content,
    });
    return this.repository.save(note);
  }

  async findAll(): Promise<Note[]> {
    return this.repository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Note> {
    return this.repository.findOne({ where: { id } });
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd backend && npm test -- notes.service.spec.ts`
Expected: PASS (3 tests)

**Step 6: Create controller**

Create `backend/src/features/notes/notes.controller.ts`:
```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Body() createNoteDto: CreateNoteDto) {
    return this.notesService.create(createNoteDto);
  }

  @Get()
  findAll() {
    return this.notesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notesService.findOne(id);
  }
}
```

**Step 7: Create module**

Create `backend/src/features/notes/notes.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { Note } from '../../shared/entities/note.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Note])],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
```

**Step 8: Commit**

```bash
git add backend/src/features/notes/
git commit -m "feat: implement notes CRUD with TDD

- Add CreateNoteDto for request validation
- Implement NotesService with create, findAll, findOne
- Add NotesController with REST endpoints
- Write unit tests with 100% coverage"
```

### Task 1.6: Create Main Application Bootstrap

**Files:**
- Create: `backend/src/app.module.ts`
- Create: `backend/src/main.ts`

**Step 1: Create app module**

Create `backend/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { HealthModule } from './core/health/health.module';
import { NotesModule } from './features/notes/notes.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    NotesModule,
  ],
})
export class AppModule {}
```

**Step 2: Create main bootstrap**

Create `backend/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://mhylle.com']
      : ['http://localhost:4200'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Notes Backend is running on port ${port}`);
  console.log(`🏥 Health Check: http://localhost:${port}/health`);
}
bootstrap();
```

**Step 3: Test backend starts**

Run: `cd backend && npm run start:dev`
Expected: Server starts on port 3000, no errors

Stop server: Ctrl+C

**Step 4: Commit**

```bash
git add backend/src/app.module.ts backend/src/main.ts
git commit -m "feat: create main application bootstrap

- Wire up all modules in AppModule
- Configure CORS for development and production
- Add startup logging with health check URL"
```

## Phase 2: Event System (Redis Integration)

### Task 2.1: Setup Redis Module

**Files:**
- Create: `backend/package.json` (update dependencies)
- Create: `backend/src/core/redis/redis.service.ts`
- Create: `backend/src/core/redis/redis.module.ts`
- Create: `backend/src/core/redis/redis.service.spec.ts`

**Step 1: Add Redis dependencies**

Update `backend/package.json` dependencies:
```json
{
  "dependencies": {
    "ioredis": "^5.3.2"
  }
}
```

Run: `cd backend && npm install`

**Step 2: Write failing test for RedisService**

Create `backend/src/core/redis/redis.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const config = {
                'redis.host': 'localhost',
                'redis.port': 6379,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish events', async () => {
    const publishSpy = jest.spyOn(service as any, 'client').mockReturnValue({
      publish: jest.fn().mockResolvedValue(1),
    });

    await expect(
      service.publish('test:channel', { data: 'test' }),
    ).resolves.not.toThrow();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd backend && npm test -- redis.service.spec.ts`
Expected: FAIL with "Cannot find module './redis.service'"

**Step 4: Implement RedisService**

Create `backend/src/core/redis/redis.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;
  private handlers: Map<string, (data: any) => void> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');

    this.client = new Redis({ host, port });
    this.subscriber = new Redis({ host, port });

    this.subscriber.on('message', (channel, message) => {
      const handler = this.handlers.get(channel);
      if (handler) {
        try {
          const data = JSON.parse(message);
          handler(data);
        } catch (error) {
          this.logger.error(`Error parsing message from ${channel}:`, error);
        }
      }
    });

    this.logger.log(`Redis connected: ${host}:${port}`);
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.subscriber.quit();
  }

  async publish(channel: string, data: any): Promise<void> {
    try {
      await this.client.publish(channel, JSON.stringify(data));
      this.logger.debug(`Published to ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to publish to ${channel}:`, error);
      throw error;
    }
  }

  async subscribe(channel: string, handler: (data: any) => void): Promise<void> {
    this.handlers.set(channel, handler);
    await this.subscriber.subscribe(channel);
    this.logger.log(`Subscribed to ${channel}`);
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd backend && npm test -- redis.service.spec.ts`
Expected: PASS (2 tests)

**Step 6: Create Redis module**

Create `backend/src/core/redis/redis.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

**Step 7: Commit**

```bash
git add backend/package.json backend/src/core/redis/
git commit -m "feat: implement Redis Pub/Sub service with TDD

- Add ioredis dependency
- Create RedisService with publish/subscribe methods
- Handle JSON serialization and error logging
- Write unit tests with mocked ConfigService"
```

### Task 2.2: Define Event Schemas

**Files:**
- Create: `backend/src/shared/events/note-created.event.ts`
- Create: `backend/src/shared/events/index.ts`

**Step 1: Create NoteCreatedEvent**

Create `backend/src/shared/events/note-created.event.ts`:
```typescript
export class NoteCreatedEvent {
  noteId: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;

  constructor(partial: Partial<NoteCreatedEvent>) {
    Object.assign(this, partial);
  }
}
```

**Step 2: Create barrel export**

Create `backend/src/shared/events/index.ts`:
```typescript
export { NoteCreatedEvent } from './note-created.event';
```

**Step 3: Commit**

```bash
git add backend/src/shared/events/
git commit -m "feat: define NoteCreatedEvent schema

- Create event class with noteId, content, metadata, timestamp
- Add constructor for easy instantiation
- Export from shared/events barrel"
```

### Task 2.3: Integrate Event Publishing in NotesService

**Files:**
- Modify: `backend/src/features/notes/notes.service.ts`
- Modify: `backend/src/features/notes/notes.module.ts`
- Modify: `backend/src/features/notes/notes.service.spec.ts`

**Step 1: Update test to verify event publishing**

Update `backend/src/features/notes/notes.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotesService } from './notes.service';
import { Note } from '../../shared/entities/note.entity';
import { RedisService } from '../../core/redis/redis.service';

describe('NotesService', () => {
  let service: NotesService;
  let repository: Repository<Note>;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: getRepositoryToken(Note),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
    repository = module.get<Repository<Note>>(getRepositoryToken(Note));
    redisService = module.get<RedisService>(RedisService);
  });

  it('should create a note and publish event', async () => {
    const createDto = { content: 'Test note' };
    const savedNote = {
      id: '123',
      content: 'Test note',
      raw_content: 'Test note',
      created_at: new Date(),
    };

    jest.spyOn(repository, 'create').mockReturnValue(savedNote as Note);
    jest.spyOn(repository, 'save').mockResolvedValue(savedNote as Note);

    const result = await service.create(createDto);

    expect(result).toEqual(savedNote);
    expect(redisService.publish).toHaveBeenCalledWith('notes:created', {
      noteId: '123',
      content: 'Test note',
      timestamp: expect.any(Date),
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- notes.service.spec.ts`
Expected: FAIL with "Expected publish to be called"

**Step 3: Update NotesService to publish events**

Update `backend/src/features/notes/notes.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from '../../shared/entities/note.entity';
import { CreateNoteDto } from './dto/create-note.dto';
import { RedisService } from '../../core/redis/redis.service';
import { NoteCreatedEvent } from '../../shared/events';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly repository: Repository<Note>,
    private readonly redisService: RedisService,
  ) {}

  async create(createNoteDto: CreateNoteDto): Promise<Note> {
    const note = this.repository.create({
      content: createNoteDto.content,
      raw_content: createNoteDto.content,
    });
    const saved = await this.repository.save(note);

    // Publish NOTE_CREATED event
    const event = new NoteCreatedEvent({
      noteId: saved.id,
      content: saved.content,
      timestamp: new Date(),
    });
    await this.redisService.publish('notes:created', event);

    return saved;
  }

  async findAll(): Promise<Note[]> {
    return this.repository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Note> {
    return this.repository.findOne({ where: { id } });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- notes.service.spec.ts`
Expected: PASS (all tests)

**Step 5: Update NotesModule to import RedisModule**

Update `backend/src/features/notes/notes.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { Note } from '../../shared/entities/note.entity';
import { RedisModule } from '../../core/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Note]),
    RedisModule,
  ],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
```

**Step 6: Update AppModule to import RedisModule**

Update `backend/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { RedisModule } from './core/redis/redis.module';
import { HealthModule } from './core/health/health.module';
import { NotesModule } from './features/notes/notes.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    NotesModule,
  ],
})
export class AppModule {}
```

**Step 7: Commit**

```bash
git add backend/src/
git commit -m "feat: integrate event publishing in NotesService

- Inject RedisService into NotesService
- Publish NoteCreatedEvent after saving note
- Update tests to verify event publishing
- Wire RedisModule into application"
```

## Phase 3: LLM Task Agent

### Task 3.1: Create LLM Service with Ollama Provider

**Files:**
- Create: `backend/src/features/llm-service/services/ai-provider.interface.ts`
- Create: `backend/src/features/llm-service/services/local-model.service.ts`
- Create: `backend/src/features/llm-service/services/local-model.service.spec.ts`
- Create: `backend/src/features/llm-service/llm.module.ts`

**Step 1: Define AI provider interface**

Create `backend/src/features/llm-service/services/ai-provider.interface.ts`:
```typescript
export interface AIProviderConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIGenerationRequest {
  prompt: string;
  config?: Partial<AIProviderConfig>;
  systemPrompt?: string;
}

export interface AIGenerationResponse {
  text: string;
  model: string;
  tokensUsed?: number;
  metadata?: Record<string, any>;
}

export interface IAIProvider {
  generateCompletion(request: AIGenerationRequest): Promise<AIGenerationResponse>;
  healthCheck(): Promise<boolean>;
  getProviderName(): string;
  getDefaultConfig(): AIProviderConfig;
}
```

**Step 2: Write failing test for LocalModelService**

Create `backend/src/features/llm-service/services/local-model.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalModelService } from './local-model.service';

describe('LocalModelService', () => {
  let service: LocalModelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalModelService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const config = {
                'ollama.baseUrl': 'http://localhost:11434',
                'ollama.defaultModel': 'deepseek-r1:32b',
                'ollama.timeout': 60000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LocalModelService>(LocalModelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return provider name', () => {
    expect(service.getProviderName()).toBe('LocalModelService (Ollama)');
  });

  it('should return default config', () => {
    const config = service.getDefaultConfig();
    expect(config.model).toBe('deepseek-r1:32b');
    expect(config.temperature).toBe(0.7);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd backend && npm test -- local-model.service.spec.ts`
Expected: FAIL with "Cannot find module"

**Step 4: Implement LocalModelService**

Create `backend/src/features/llm-service/services/local-model.service.ts`:
```typescript
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
```

**Step 5: Run test to verify it passes**

Run: `cd backend && npm test -- local-model.service.spec.ts`
Expected: PASS (all tests)

**Step 6: Create LLM module**

Create `backend/src/features/llm-service/llm.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { LocalModelService } from './services/local-model.service';

@Module({
  providers: [LocalModelService],
  exports: [LocalModelService],
})
export class LLMModule {}
```

**Step 7: Commit**

```bash
git add backend/src/features/llm-service/
git commit -m "feat: implement LLM service with Ollama provider

- Define IAIProvider interface for abstraction
- Implement LocalModelService using axios
- Add health check to verify model availability
- Write unit tests with ConfigService mocking"
```

### Task 3.2: Create Task Entity and Repository

**Files:**
- Create: `backend/src/shared/entities/task.entity.ts`
- Modify: `backend/src/shared/entities/index.ts`
- Modify: `backend/src/core/database/database.module.ts`

**Step 1: Create Task entity**

Create `backend/src/shared/entities/task.entity.ts`:
```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Note } from './note.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  note_id: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 50, default: 'medium' })
  priority: string;

  @Column({ type: 'timestamp', nullable: true })
  due_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'float', nullable: true })
  llm_confidence: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
```

**Step 2: Update entities barrel**

Update `backend/src/shared/entities/index.ts`:
```typescript
export { Note } from './note.entity';
export { Task } from './task.entity';
```

**Step 3: Update database module**

Update `backend/src/core/database/database.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Note, Task } from '../../shared/entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [Note, Task],
        synchronize: configService.get('environment') !== 'production',
        logging: configService.get('environment') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
```

**Step 4: Commit**

```bash
git add backend/src/shared/entities/ backend/src/core/database/
git commit -m "feat: add Task entity with relation to Note

- Create Task entity with status, priority, due_date
- Add llm_confidence field for AI extraction quality
- Define ManyToOne relation to Note with CASCADE delete
- Register Task in DatabaseModule"
```

### Task 3.3: Create Task Extraction Prompt

**Files:**
- Create: `backend/src/features/llm-service/prompts/task-extraction.prompt.ts`

**Step 1: Create prompt template**

Create `backend/src/features/llm-service/prompts/task-extraction.prompt.ts`:
```typescript
export const TASK_EXTRACTION_PROMPT = (noteContent: string) => `
You are a task extraction assistant. Analyze the following note and extract any actionable tasks.

Note: "${noteContent}"

Extract tasks in JSON format with this structure:
{
  "tasks": [
    {
      "title": "brief task description",
      "description": "detailed context if available",
      "priority": "low|medium|high",
      "dueDate": "ISO date if mentioned, null otherwise",
      "confidence": 0.0-1.0 (your confidence in this being a task)
    }
  ]
}

Rules:
- Only extract clear, actionable tasks
- Ignore vague statements or observations
- Set confidence < 0.5 for ambiguous tasks
- Extract due dates from phrases like "tomorrow", "next week", "Friday"
- Return empty array if no tasks found
- Respond ONLY with valid JSON, no other text

Example:
Input: "Buy groceries tomorrow and call mom next week"
Output: {"tasks":[{"title":"Buy groceries","description":"","priority":"medium","dueDate":"<tomorrow's ISO date>","confidence":0.9},{"title":"Call mom","description":"","priority":"medium","dueDate":"<next week ISO date>","confidence":0.9}]}
`.trim();
```

**Step 2: Commit**

```bash
git add backend/src/features/llm-service/prompts/
git commit -m "feat: create task extraction prompt for DeepSeek-R1

- Define structured prompt requesting JSON output
- Include rules for confidence scoring and date parsing
- Add example for clarity
- Request JSON-only response for reliable parsing"
```

### Task 3.4: Create Task Agent Service

**Files:**
- Create: `backend/src/features/task-agent/task-agent.service.ts`
- Create: `backend/src/features/task-agent/task-agent.service.spec.ts`
- Create: `backend/src/features/task-agent/task-agent.module.ts`

**Step 1: Write failing test**

Create `backend/src/features/task-agent/task-agent.service.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskAgentService } from './task-agent.service';
import { Task } from '../../shared/entities/task.entity';
import { LocalModelService } from '../llm-service/services/local-model.service';

describe('TaskAgentService', () => {
  let service: TaskAgentService;
  let repository: Repository<Task>;
  let llmService: LocalModelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskAgentService,
        {
          provide: getRepositoryToken(Task),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: LocalModelService,
          useValue: {
            generateCompletion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TaskAgentService>(TaskAgentService);
    repository = module.get<Repository<Task>>(getRepositoryToken(Task));
    llmService = module.get<LocalModelService>(LocalModelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extract tasks from note content', async () => {
    const noteId = '123';
    const content = 'Buy groceries tomorrow';

    jest.spyOn(llmService, 'generateCompletion').mockResolvedValue({
      text: JSON.stringify({
        tasks: [
          {
            title: 'Buy groceries',
            description: '',
            priority: 'medium',
            dueDate: new Date().toISOString(),
            confidence: 0.9,
          },
        ],
      }),
      model: 'deepseek-r1:32b',
    });

    jest.spyOn(repository, 'create').mockReturnValue({} as Task);
    jest.spyOn(repository, 'save').mockResolvedValue({} as Task);

    await service.extractTasks(noteId, content);

    expect(llmService.generateCompletion).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- task-agent.service.spec.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement TaskAgentService**

Create `backend/src/features/task-agent/task-agent.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../shared/entities/task.entity';
import { LocalModelService } from '../llm-service/services/local-model.service';
import { TASK_EXTRACTION_PROMPT } from '../llm-service/prompts/task-extraction.prompt';

interface ExtractedTask {
  title: string;
  description: string;
  priority: string;
  dueDate: string | null;
  confidence: number;
}

@Injectable()
export class TaskAgentService {
  private readonly logger = new Logger(TaskAgentService.name);

  constructor(
    @InjectRepository(Task)
    private readonly repository: Repository<Task>,
    private readonly llmService: LocalModelService,
  ) {}

  async extractTasks(noteId: string, content: string): Promise<Task[]> {
    this.logger.log(`Extracting tasks from note ${noteId}`);

    try {
      const prompt = TASK_EXTRACTION_PROMPT(content);

      const response = await this.llmService.generateCompletion({
        prompt,
        config: { temperature: 0.7 },
      });

      const result = JSON.parse(response.text);
      const extractedTasks: ExtractedTask[] = result.tasks || [];

      this.logger.log(`Extracted ${extractedTasks.length} tasks`);

      const tasks: Task[] = [];
      for (const extracted of extractedTasks) {
        if (extracted.confidence >= 0.5) {
          const task = this.repository.create({
            note_id: noteId,
            title: extracted.title,
            description: extracted.description || null,
            priority: extracted.priority,
            due_date: extracted.dueDate ? new Date(extracted.dueDate) : null,
            llm_confidence: extracted.confidence,
            status: 'pending',
          });

          const saved = await this.repository.save(task);
          tasks.push(saved);
        } else {
          this.logger.debug(
            `Skipping low-confidence task: ${extracted.title} (${extracted.confidence})`,
          );
        }
      }

      return tasks;
    } catch (error) {
      this.logger.error(`Failed to extract tasks: ${error.message}`);
      throw error;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- task-agent.service.spec.ts`
Expected: PASS (2 tests)

**Step 5: Create task agent module**

Create `backend/src/features/task-agent/task-agent.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskAgentService } from './task-agent.service';
import { Task } from '../../shared/entities/task.entity';
import { LLMModule } from '../llm-service/llm.module';
import { RedisModule } from '../../core/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    LLMModule,
    RedisModule,
  ],
  providers: [TaskAgentService],
  exports: [TaskAgentService],
})
export class TaskAgentModule {}
```

**Step 6: Commit**

```bash
git add backend/src/features/task-agent/
git commit -m "feat: implement task extraction service with TDD

- Create TaskAgentService using LocalModelService
- Parse JSON response and create Task entities
- Filter tasks by confidence threshold (≥0.5)
- Write unit tests with mocked dependencies"
```

### Task 3.5: Subscribe to NOTE_CREATED Events

**Files:**
- Create: `backend/src/features/task-agent/task-listener.service.ts`
- Modify: `backend/src/features/task-agent/task-agent.module.ts`

**Step 1: Create listener service**

Create `backend/src/features/task-agent/task-listener.service.ts`:
```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RedisService } from '../../core/redis/redis.service';
import { TaskAgentService } from './task-agent.service';
import { NoteCreatedEvent } from '../../shared/events';

@Injectable()
export class TaskListenerService implements OnModuleInit {
  private readonly logger = new Logger(TaskListenerService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly taskAgentService: TaskAgentService,
  ) {}

  async onModuleInit() {
    await this.redisService.subscribe(
      'notes:created',
      this.handleNoteCreated.bind(this),
    );
    this.logger.log('Subscribed to notes:created events');
  }

  private async handleNoteCreated(event: NoteCreatedEvent) {
    this.logger.log(`Processing note ${event.noteId}`);

    try {
      const tasks = await this.taskAgentService.extractTasks(
        event.noteId,
        event.content,
      );

      this.logger.log(
        `Created ${tasks.length} tasks for note ${event.noteId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process note ${event.noteId}: ${error.message}`,
      );
    }
  }
}
```

**Step 2: Update module to include listener**

Update `backend/src/features/task-agent/task-agent.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskAgentService } from './task-agent.service';
import { TaskListenerService } from './task-listener.service';
import { Task } from '../../shared/entities/task.entity';
import { LLMModule } from '../llm-service/llm.module';
import { RedisModule } from '../../core/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    LLMModule,
    RedisModule,
  ],
  providers: [TaskAgentService, TaskListenerService],
  exports: [TaskAgentService],
})
export class TaskAgentModule {}
```

**Step 3: Wire TaskAgentModule into AppModule**

Update `backend/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { RedisModule } from './core/redis/redis.module';
import { HealthModule } from './core/health/health.module';
import { NotesModule } from './features/notes/notes.module';
import { LLMModule } from './features/llm-service/llm.module';
import { TaskAgentModule } from './features/task-agent/task-agent.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    NotesModule,
    LLMModule,
    TaskAgentModule,
  ],
})
export class AppModule {}
```

**Step 4: Commit**

```bash
git add backend/src/features/task-agent/ backend/src/app.module.ts
git commit -m "feat: subscribe to NOTE_CREATED events in task agent

- Create TaskListenerService subscribing to notes:created
- Automatically trigger task extraction on new notes
- Add error handling and logging
- Wire TaskAgentModule into AppModule"
```

---

## Frontend Implementation (Minimal Phase 1)

The plan continues with frontend implementation in the next document section. This represents approximately 50% of the total implementation work.

**Estimated completion time:**
- Phase 1 (Backend): 6-8 hours
- Phase 2 (Events): 2-3 hours
- Phase 3 (LLM Agent): 4-5 hours
- Frontend: 6-8 hours
- Docker/Deployment: 2-3 hours

**Total**: 20-27 hours for Phase 1-3 implementation

---

## Execution Notes

**Prerequisites:**
- PostgreSQL running with `notes_db` database
- Redis running on localhost:6379
- Ollama running with deepseek-r1:32b model pulled
- Node.js 20+

**Test Each Phase:**
- Phase 1: `npm test && npm run start:dev` (verify health endpoint)
- Phase 2: Create note via API, check Redis events with `redis-cli MONITOR`
- Phase 3: Create note, verify tasks created in database

**Next Steps:**
- Frontend Angular implementation (separate task list)
- Docker Compose configuration
- GitHub Actions CI/CD setup
