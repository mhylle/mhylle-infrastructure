# Notes System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered personal note-taking system that automatically extracts tasks from notes using local Ollama LLM (DeepSeek-R1:32B).

**Architecture:** Modular monolith NestJS backend with core/features/shared structure, Angular 20 frontend, Redis Pub/Sub for event-driven communication, PostgreSQL for persistence, Ollama for AI processing.

**Tech Stack:** NestJS 11, Angular 20, TypeORM, PostgreSQL, Redis, Ollama (DeepSeek-R1:32B), Docker

**Reference:** See `docs/plans/2025-10-28-notes-system-design.md` for complete design.

---

## Implementation Status

### Phase 1: Backend Foundation ✅ COMPLETED
- [x] Task 1.1: Backend package.json (commit: 965aa0e)
- [x] Task 1.2: TypeScript configuration (commit: ed86478)
- [x] Task 1.3: Database module (commit: multiple - main.ts, app.module.ts, database setup)
- [x] Task 1.4: Health check module (commit: 33abd2f)
- [x] Task 1.5: Notes CRUD module (commit: 9605899)
- [x] Task 1.6: Bootstrap application (commit: 9492380)

**Phase 1 Summary:** Backend foundation is complete with NestJS 11, TypeORM, PostgreSQL integration, health checks, and basic CRUD operations for notes. All tests passing. System is ready for Phase 1.5 (Basic Frontend).

### Phase 1.5: Basic Frontend 🔄 IN PROGRESS
- [x] Task 1.5.1: Angular 20 setup (commit: a2a97e1)
- [x] Task 1.5.2: Material Design configuration (commit: a32730b)
- [x] Task 1.5.3: API service with TDD (commit: 437b62e)
- [ ] Task 1.5.4: Note list component
- [ ] Task 1.5.5: Note editor component
- [ ] Task 1.5.6: Routing setup

**Phase 1.5 Progress:** Angular 20 project initialized with Material Design. API service complete with environment-based configuration (port 3005). Tests passing (6/6). Ready for component implementation.

## Session Notes

### Session 2025-10-29: Phase 1 & Phase 1.5 (Partial)

**Completed:**
- Phase 1: Backend Foundation ✅ (all 6 tasks)
- Phase 1.5: Tasks 1.5.1-1.5.3 ✅ (Angular setup, Material Design, API service)

**Testing:**
- Backend tested manually: All CRUD endpoints working on port 3005
- Frontend tests: 6/6 passing (NotesApiService)
- Backend API: `http://localhost:3005/api/notes/notes`
- Frontend dev server: `http://localhost:4200` (compile error due to missing NoteListComponent - expected)

**Current State:**
- Backend running successfully with tested endpoints
- Frontend project structure complete with Material Design
- API service implemented with environment variables
- Routing configured but waiting for NoteListComponent (Task 1.5.4)

**Next Steps:**
- Continue with Tasks 1.5.4-1.5.6 to complete Phase 1.5
- Tasks 1.5.4-1.5.6 will implement UI components for notes CRUD

---

### Phase 2: Event System 📋 PENDING
- [ ] Task 2.1: Redis module
- [ ] Task 2.2: Event schemas
- [ ] Task 2.3: Event integration

### Phase 3: LLM Task Agent 📋 PENDING
- [ ] Task 3.1: LLM provider interface
- [ ] Task 3.2: Task entity
- [ ] Task 3.3: Task extraction prompt
- [ ] Task 3.4: Task agent service
- [ ] Task 3.5: Task listener

### Phase 4: Deployment 📋 PENDING
- [ ] Docker Compose configuration
- [ ] GitHub Actions CI/CD
- [ ] Production deployment

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

## Phase 1.5: Basic Frontend for Notes CRUD

### Task 1.5.1: Initialize Angular 20 Project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/angular.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/index.html`
- Create: `frontend/.env.example`

**Step 1: Create frontend directory and initialize Angular**

```bash
mkdir -p frontend
cd frontend
```

Create `frontend/package.json`:
```json
{
  "name": "notes-frontend",
  "version": "1.0.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "test": "ng test",
    "lint": "ng lint"
  },
  "dependencies": {
    "@angular/animations": "^20.0.0",
    "@angular/common": "^20.0.0",
    "@angular/compiler": "^20.0.0",
    "@angular/core": "^20.0.0",
    "@angular/forms": "^20.0.0",
    "@angular/material": "^20.0.0",
    "@angular/platform-browser": "^20.0.0",
    "@angular/platform-browser-dynamic": "^20.0.0",
    "@angular/router": "^20.0.0",
    "rxjs": "^7.8.1",
    "tslib": "^2.8.1",
    "zone.js": "^0.15.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^20.0.0",
    "@angular/cli": "^20.0.0",
    "@angular/compiler-cli": "^20.0.0",
    "@types/jasmine": "~5.1.0",
    "jasmine-core": "~5.4.0",
    "karma": "~6.4.4",
    "karma-chrome-launcher": "~3.2.0",
    "karma-coverage": "~2.2.0",
    "karma-jasmine": "~5.1.0",
    "karma-jasmine-html-reporter": "~2.1.0",
    "typescript": "~5.7.2"
  }
}
```

**Step 2: Create Angular configuration**

Create `frontend/angular.json`:
```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "notes-frontend": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.css"],
            "scripts": []
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kB",
                  "maximumError": "2MB"
                }
              ],
              "outputHashing": "all"
            }
          }
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "configurations": {
            "production": {
              "buildTarget": "notes-frontend:build:production"
            }
          },
          "options": {
            "buildTarget": "notes-frontend:build",
            "port": 4200
          }
        },
        "test": {
          "builder": "@angular-devkit/build-angular:karma",
          "options": {
            "polyfills": ["zone.js", "zone.js/testing"],
            "tsConfig": "tsconfig.spec.json",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.css"],
            "scripts": []
          }
        }
      }
    }
  }
}
```

**Step 3: Create TypeScript configurations**

Create `frontend/tsconfig.json`:
```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "outDir": "./dist/out-tsc",
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "sourceMap": true,
    "declaration": false,
    "experimentalDecorators": true,
    "moduleResolution": "bundler",
    "importHelpers": true,
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022", "dom"]
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

Create `frontend/tsconfig.app.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"]
}
```

Create `frontend/tsconfig.spec.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["jasmine"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

**Step 4: Create environment configuration**

Create `frontend/.env.example`:
```bash
# Backend API Configuration
API_URL=http://localhost:3000
NODE_ENV=development
```

**Step 5: Install dependencies**

Run: `npm install`
Expected: Dependencies installed successfully

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: initialize Angular 20 frontend project

- Add package.json with Angular 20 and Material dependencies
- Configure angular.json with build and serve targets
- Setup TypeScript configuration with strict mode
- Add environment configuration example"
```

### Task 1.5.2: Setup Material Design and App Structure

**Files:**
- Create: `frontend/src/app/app.config.ts`
- Create: `frontend/src/app/app.component.ts`
- Create: `frontend/src/app/app.component.html`
- Create: `frontend/src/app/app.component.css`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/index.html`
- Create: `frontend/src/styles.css`

**Step 1: Create main application files**

Create `frontend/src/main.ts`:
```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
```

Create `frontend/src/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Notes System</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</head>
<body class="mat-typography">
  <app-root></app-root>
</body>
</html>
```

Create `frontend/src/styles.css`:
```css
@import '@angular/material/prebuilt-themes/indigo-pink.css';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
}

body {
  font-family: Roboto, "Helvetica Neue", sans-serif;
}
```

**Step 2: Create app configuration with Material Design**

Create `frontend/src/app/app.config.ts`:
```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync()
  ]
};
```

**Step 3: Create routes file**

Create `frontend/src/app/app.routes.ts`:
```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/notes',
    pathMatch: 'full'
  },
  {
    path: 'notes',
    loadComponent: () => import('./features/notes/note-list/note-list.component').then(m => m.NoteListComponent)
  }
];
```

**Step 4: Create root component**

Create `frontend/src/app/app.component.ts`:
```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatToolbarModule, MatIconModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Notes System';
}
```

Create `frontend/src/app/app.component.html`:
```html
<mat-toolbar color="primary">
  <mat-icon>note</mat-icon>
  <span class="toolbar-title">{{ title }}</span>
</mat-toolbar>

<main class="main-content">
  <router-outlet></router-outlet>
</main>
```

Create `frontend/src/app/app.component.css`:
```css
.toolbar-title {
  margin-left: 8px;
}

.main-content {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
```

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: setup Material Design and app structure

- Configure standalone Angular app with Material Design
- Add routing configuration with lazy-loaded notes feature
- Create root component with Material toolbar
- Import Material theme and typography"
```

### Task 1.5.3: Create Notes API Service

**Files:**
- Create: `frontend/src/app/core/services/notes-api.service.ts`
- Create: `frontend/src/app/core/services/notes-api.service.spec.ts`
- Create: `frontend/src/app/core/models/note.model.ts`

**Step 1: Define Note model**

Create `frontend/src/app/core/models/note.model.ts`:
```typescript
export interface Note {
  id: string;
  content: string;
  raw_content: string;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
  source: string;
}

export interface CreateNoteDto {
  content: string;
}
```

**Step 2: Write failing test for NotesApiService**

Create `frontend/src/app/core/services/notes-api.service.spec.ts`:
```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotesApiService } from './notes-api.service';
import { Note, CreateNoteDto } from '../models/note.model';

describe('NotesApiService', () => {
  let service: NotesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotesApiService]
    });
    service = TestBed.inject(NotesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all notes', () => {
    const mockNotes: Note[] = [
      {
        id: '1',
        content: 'Test note',
        raw_content: 'Test note',
        created_at: new Date(),
        updated_at: new Date(),
        source: 'text'
      }
    ];

    service.getNotes().subscribe(notes => {
      expect(notes.length).toBe(1);
      expect(notes[0].content).toBe('Test note');
    });

    const req = httpMock.expectOne('http://localhost:3000/notes');
    expect(req.request.method).toBe('GET');
    req.flush(mockNotes);
  });

  it('should create a note', () => {
    const createDto: CreateNoteDto = { content: 'New note' };
    const mockNote: Note = {
      id: '1',
      content: 'New note',
      raw_content: 'New note',
      created_at: new Date(),
      updated_at: new Date(),
      source: 'text'
    };

    service.createNote(createDto).subscribe(note => {
      expect(note.content).toBe('New note');
    });

    const req = httpMock.expectOne('http://localhost:3000/notes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createDto);
    req.flush(mockNote);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL with "Cannot find module './notes-api.service'"

**Step 4: Implement NotesApiService**

Create `frontend/src/app/core/services/notes-api.service.ts`:
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Note, CreateNoteDto } from '../models/note.model';

@Injectable({
  providedIn: 'root'
})
export class NotesApiService {
  private readonly apiUrl = 'http://localhost:3000/notes';

  constructor(private http: HttpClient) {}

  getNotes(): Observable<Note[]> {
    return this.http.get<Note[]>(this.apiUrl);
  }

  getNote(id: string): Observable<Note> {
    return this.http.get<Note>(`${this.apiUrl}/${id}`);
  }

  createNote(dto: CreateNoteDto): Observable<Note> {
    return this.http.post<Note>(this.apiUrl, dto);
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS (all tests)

**Step 6: Commit**

```bash
git add frontend/src/app/core/
git commit -m "feat: implement notes API service with TDD

- Define Note and CreateNoteDto interfaces
- Create NotesApiService with GET and POST methods
- Write unit tests with HttpClientTestingModule
- All tests passing"
```

### Task 1.5.4: Create Note List Component

**Files:**
- Create: `frontend/src/app/features/notes/note-list/note-list.component.ts`
- Create: `frontend/src/app/features/notes/note-list/note-list.component.html`
- Create: `frontend/src/app/features/notes/note-list/note-list.component.css`
- Create: `frontend/src/app/features/notes/note-list/note-list.component.spec.ts`

**Step 1: Write failing test**

Create `frontend/src/app/features/notes/note-list/note-list.component.spec.ts`:
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoteListComponent } from './note-list.component';
import { NotesApiService } from '../../../core/services/notes-api.service';
import { of } from 'rxjs';
import { Note } from '../../../core/models/note.model';

describe('NoteListComponent', () => {
  let component: NoteListComponent;
  let fixture: ComponentFixture<NoteListComponent>;
  let notesService: NotesApiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteListComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(NoteListComponent);
    component = fixture.componentInstance;
    notesService = TestBed.inject(NotesApiService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load notes on init', () => {
    const mockNotes: Note[] = [
      {
        id: '1',
        content: 'Test note',
        raw_content: 'Test note',
        created_at: new Date(),
        updated_at: new Date(),
        source: 'text'
      }
    ];

    spyOn(notesService, 'getNotes').and.returnValue(of(mockNotes));

    component.ngOnInit();

    expect(notesService.getNotes).toHaveBeenCalled();
    expect(component.notes().length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL with "Cannot find module"

**Step 3: Implement component**

Create `frontend/src/app/features/notes/note-list/note-list.component.ts`:
```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { NotesApiService } from '../../../core/services/notes-api.service';
import { Note } from '../../../core/models/note.model';

@Component({
  selector: 'app-note-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './note-list.component.html',
  styleUrl: './note-list.component.css'
})
export class NoteListComponent implements OnInit {
  notes = signal<Note[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private notesService: NotesApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    this.loading.set(true);
    this.error.set(null);

    this.notesService.getNotes().subscribe({
      next: (notes) => {
        this.notes.set(notes);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load notes');
        this.loading.set(false);
        console.error('Error loading notes:', err);
      }
    });
  }

  createNote(): void {
    this.router.navigate(['/notes/new']);
  }

  editNote(id: string): void {
    this.router.navigate(['/notes/edit', id]);
  }
}
```

Create `frontend/src/app/features/notes/note-list/note-list.component.html`:
```html
<div class="note-list-container">
  <div class="header">
    <h2>My Notes</h2>
    <button mat-raised-button color="primary" (click)="createNote()">
      <mat-icon>add</mat-icon>
      New Note
    </button>
  </div>

  @if (loading()) {
    <div class="loading-container">
      <mat-spinner></mat-spinner>
    </div>
  }

  @if (error()) {
    <div class="error-message">
      {{ error() }}
    </div>
  }

  @if (!loading() && !error()) {
    @if (notes().length === 0) {
      <div class="empty-state">
        <mat-icon>note_add</mat-icon>
        <p>No notes yet. Create your first note!</p>
      </div>
    } @else {
      <div class="notes-grid">
        @for (note of notes(); track note.id) {
          <mat-card class="note-card">
            <mat-card-content>
              <p class="note-content">{{ note.content }}</p>
              <span class="note-date">{{ note.created_at | date:'short' }}</span>
            </mat-card-content>
            <mat-card-actions>
              <button mat-button (click)="editNote(note.id)">
                <mat-icon>edit</mat-icon>
                Edit
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    }
  }
</div>
```

Create `frontend/src/app/features/notes/note-list/note-list.component.css`:
```css
.note-list-container {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.error-message {
  color: #f44336;
  padding: 16px;
  background-color: #ffebee;
  border-radius: 4px;
  margin-bottom: 16px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #757575;
}

.empty-state mat-icon {
  font-size: 64px;
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.note-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.note-card:hover {
  transform: translateY(-4px);
}

.note-content {
  margin: 0 0 12px 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.note-date {
  font-size: 12px;
  color: #757575;
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add frontend/src/app/features/notes/note-list/
git commit -m "feat: implement note list component with Material Design

- Create NoteListComponent with signal-based state management
- Display notes in responsive grid layout
- Add loading and error states
- Implement navigation to create/edit notes
- Write unit tests with NotesApiService mock"
```

### Task 1.5.5: Create Note Editor Component

**Files:**
- Create: `frontend/src/app/features/notes/note-editor/note-editor.component.ts`
- Create: `frontend/src/app/features/notes/note-editor/note-editor.component.html`
- Create: `frontend/src/app/features/notes/note-editor/note-editor.component.css`
- Create: `frontend/src/app/features/notes/note-editor/note-editor.component.spec.ts`

**Step 1: Write failing test**

Create `frontend/src/app/features/notes/note-editor/note-editor.component.spec.ts`:
```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoteEditorComponent } from './note-editor.component';
import { NotesApiService } from '../../../core/services/notes-api.service';
import { of } from 'rxjs';

describe('NoteEditorComponent', () => {
  let component: NoteEditorComponent;
  let fixture: ComponentFixture<NoteEditorComponent>;
  let notesService: NotesApiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteEditorComponent, HttpClientTestingModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(NoteEditorComponent);
    component = fixture.componentInstance;
    notesService = TestBed.inject(NotesApiService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should save note on submit', () => {
    const mockNote = {
      id: '1',
      content: 'Test note',
      raw_content: 'Test note',
      created_at: new Date(),
      updated_at: new Date(),
      source: 'text'
    };

    spyOn(notesService, 'createNote').and.returnValue(of(mockNote));

    component.content.set('Test note');
    component.saveNote();

    expect(notesService.createNote).toHaveBeenCalledWith({ content: 'Test note' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test`
Expected: FAIL with "Cannot find module"

**Step 3: Implement component**

Create `frontend/src/app/features/notes/note-editor/note-editor.component.ts`:
```typescript
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { NotesApiService } from '../../../core/services/notes-api.service';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './note-editor.component.html',
  styleUrl: './note-editor.component.css'
})
export class NoteEditorComponent {
  content = signal('');
  saving = signal(false);
  error = signal<string | null>(null);

  constructor(
    private notesService: NotesApiService,
    private router: Router
  ) {}

  saveNote(): void {
    const trimmedContent = this.content().trim();

    if (!trimmedContent) {
      this.error.set('Note content cannot be empty');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.notesService.createNote({ content: trimmedContent }).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/notes']);
      },
      error: (err) => {
        this.error.set('Failed to save note');
        this.saving.set(false);
        console.error('Error saving note:', err);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/notes']);
  }
}
```

Create `frontend/src/app/features/notes/note-editor/note-editor.component.html`:
```html
<div class="editor-container">
  <div class="header">
    <h2>Create Note</h2>
  </div>

  @if (error()) {
    <div class="error-message">
      {{ error() }}
    </div>
  }

  <mat-form-field appearance="outline" class="full-width">
    <mat-label>Note Content</mat-label>
    <textarea
      matInput
      [value]="content()"
      (input)="content.set($any($event.target).value)"
      placeholder="Write your note here..."
      rows="10"
      [disabled]="saving()">
    </textarea>
  </mat-form-field>

  <div class="actions">
    <button mat-button (click)="cancel()" [disabled]="saving()">
      Cancel
    </button>
    <button
      mat-raised-button
      color="primary"
      (click)="saveNote()"
      [disabled]="saving() || !content().trim()">
      @if (saving()) {
        <mat-spinner diameter="20"></mat-spinner>
        Saving...
      } @else {
        <mat-icon>save</mat-icon>
        Save Note
      }
    </button>
  </div>
</div>
```

Create `frontend/src/app/features/notes/note-editor/note-editor.component.css`:
```css
.editor-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  margin-bottom: 24px;
}

.header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
}

.error-message {
  color: #f44336;
  padding: 16px;
  background-color: #ffebee;
  border-radius: 4px;
  margin-bottom: 16px;
}

.full-width {
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

button mat-spinner {
  display: inline-block;
  margin-right: 8px;
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add frontend/src/app/features/notes/note-editor/
git commit -m "feat: implement note editor component

- Create NoteEditorComponent with Material form fields
- Add validation for empty content
- Implement save and cancel actions with navigation
- Show loading state during save operation
- Write unit tests with NotesApiService mock"
```

### Task 1.5.6: Update Routing and Test Frontend

**Files:**
- Modify: `frontend/src/app/app.routes.ts`

**Step 1: Update routing configuration**

Update `frontend/src/app/app.routes.ts`:
```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/notes',
    pathMatch: 'full'
  },
  {
    path: 'notes',
    loadComponent: () => import('./features/notes/note-list/note-list.component').then(m => m.NoteListComponent)
  },
  {
    path: 'notes/new',
    loadComponent: () => import('./features/notes/note-editor/note-editor.component').then(m => m.NoteEditorComponent)
  },
  {
    path: 'notes/edit/:id',
    loadComponent: () => import('./features/notes/note-editor/note-editor.component').then(m => m.NoteEditorComponent)
  }
];
```

**Step 2: Test frontend locally**

Run backend:
```bash
cd backend
npm run start:dev
```

Run frontend:
```bash
cd frontend
npm start
```

Open browser: `http://localhost:4200`

Expected:
- Notes list displays
- Can navigate to create new note
- Can create note and see it in list
- All tests pass: `npm test`

**Step 3: Commit**

```bash
git add frontend/src/app/app.routes.ts
git commit -m "feat: configure routing for note list and editor

- Add routes for /notes, /notes/new, /notes/edit/:id
- Implement lazy loading for all note components
- Test end-to-end create and list functionality"
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

## Phase Summary

**Phase 1: Backend Foundation** (Completed)
- NestJS 11 backend with TypeORM and PostgreSQL
- Health checks and basic CRUD operations for notes
- All tests passing

**Phase 1.5: Basic Frontend for Notes CRUD** (Pending)
- Angular 20 with Material Design
- Note list and editor components
- End-to-end note creation and viewing

**Phase 2: Event System** (Pending)
- Redis Pub/Sub integration
- Event-driven architecture for note creation

**Phase 3: LLM Task Agent** (Pending)
- Ollama integration with DeepSeek-R1:32B
- Automatic task extraction from notes
- Event listener for NOTE_CREATED events

**Phase 4: Deployment** (Pending)
- Docker Compose configuration
- GitHub Actions CI/CD
- Production deployment

**Estimated completion time:**
- Phase 1 (Backend): 6-8 hours ✅ COMPLETED
- Phase 1.5 (Frontend): 6-8 hours
- Phase 2 (Events): 2-3 hours
- Phase 3 (LLM Agent): 4-5 hours
- Phase 4 (Deployment): 2-3 hours

**Total**: 20-27 hours for complete implementation

---

## Execution Notes

**Prerequisites:**
- PostgreSQL running with `notes_db` database
- Redis running on localhost:6379 (Phase 2+)
- Ollama running with deepseek-r1:32b model pulled (Phase 3+)
- Node.js 20+

**Test Each Phase:**
- Phase 1 (Backend): `npm test && npm run start:dev` (verify health endpoint) ✅
- Phase 1.5 (Frontend): Test create/list notes at http://localhost:4200
- Phase 2 (Events): Create note via API, check Redis events with `redis-cli MONITOR`
- Phase 3 (LLM): Create note, verify tasks created in database
- Phase 4 (Deployment): Health checks and end-to-end testing in production

**Current Status:**
Phase 1 complete. Ready to begin Phase 1.5 (Basic Frontend) which must be completed before moving to Phase 2 (Event System).
