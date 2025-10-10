# Phase 0: Technical Research

**Feature**: Notes CRUD, Conversations, and Categorization
**Date**: 2025-10-05
**Status**: Complete

## Research Topics

### 1. TypeORM Many-to-Many Relationships

**Decision**: Use `@ManyToMany` with `@JoinTable` on owning side, enable cascade operations selectively

**Rationale**:
- TypeORM `@ManyToMany` automatically manages junction tables
- `@JoinTable` decorator specifies which entity owns the relationship (handles insert/delete in junction table)
- Cascade options (`cascade: ['insert', 'update']`) control automatic persistence without cascade deletion (preserve entities when relationships break)
- Custom junction table names improve clarity: `note_categories`, `conversation_categories`

**Pattern**:
```typescript
// Category entity (non-owning side)
@ManyToMany(() => Note, note => note.categories)
notes: Note[];

@ManyToMany(() => Conversation, conversation => conversation.categories)
conversations: Conversation[];

// Note entity (owning side)
@ManyToMany(() => Category, category => category.notes, { cascade: ['insert', 'update'] })
@JoinTable({ name: 'note_categories' })
categories: Category[];

// Conversation entity (owning side)
@ManyToMany(() => Category, category => category.conversations, { cascade: ['insert', 'update'] })
@JoinTable({ name: 'conversation_categories' })
categories: Category[];
```

**Alternatives Considered**:
- Manual junction table entities: Rejected (more complex, TypeORM handles this well automatically)
- Cascade delete on categories: Rejected (would delete notes/conversations when category deleted)

**References**:
- TypeORM Many-to-Many Relations: https://typeorm.io/many-to-many-relations
- Cascade Options: https://typeorm.io/relations#cascade-options

---

### 2. NestJS DTO Validation Patterns

**Decision**: Use class-validator decorators with `@IsOptional()`, `@IsArray()`, `@ValidateNested()` for flexible validation

**Rationale**:
- `@IsOptional()` allows fields to be undefined/null while still validating when present
- `@IsArray()` with `@IsUUID('4', { each: true })` validates array elements
- `@ValidateNested({ each: true })` validates nested objects/arrays
- `@Type()` from class-transformer enables proper type coercion

**Patterns**:
```typescript
// Optional field validation
export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

// Array validation
export class AssignCategoriesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds: string[];
}

// Enum validation
export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(['system', 'user'])
  type: 'system' | 'user';
}
```

**Alternatives Considered**:
- Joi schemas: Rejected (class-validator integrates better with NestJS, uses decorators)
- Manual validation in services: Rejected (duplicates logic, harder to maintain)

**References**:
- class-validator GitHub: https://github.com/typestack/class-validator
- NestJS Validation Pipe: https://docs.nestjs.com/techniques/validation

---

### 3. Angular Standalone Component Communication

**Decision**: Service-based state management with RxJS BehaviorSubject for shared state, Input/Output for parent-child

**Rationale**:
- Angular 19 standalone components work well with injectable services for global state
- `BehaviorSubject` provides current value + stream updates (ideal for lists that change)
- Services eliminate need for complex state libraries for this feature scope
- Input/Output properties for tight parent-child coupling (conversation → notes list)

**Patterns**:
```typescript
// Shared service with state
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  categories$ = this.categoriesSubject.asObservable();

  loadCategories() {
    this.http.get<Category[]>('/api/categories').subscribe(
      categories => this.categoriesSubject.next(categories)
    );
  }

  refreshCategories() {
    this.loadCategories();
  }
}

// Component consumption
export class NoteFormComponent {
  categories$ = this.categoryService.categories$;

  constructor(private categoryService: CategoryService) {
    this.categoryService.loadCategories();
  }
}

// Parent-child with Input/Output
export class ConversationDetailComponent {
  @Input({ required: true }) conversationId!: string;
  notes: Note[] = [];

  loadNotes() {
    this.conversationService.getNotes(this.conversationId)
      .subscribe(notes => this.notes = notes);
  }
}
```

**Alternatives Considered**:
- NgRx/Akita: Rejected (overkill for feature scope, adds complexity)
- Event emitters only: Rejected (hard to maintain for non-parent-child relationships)
- Signals (Angular 16+): Deferred (RxJS more mature for HTTP integration, signals can be added later)

**References**:
- Angular Services & Dependency Injection: https://angular.io/guide/architecture-services
- RxJS BehaviorSubject: https://rxjs.dev/api/index/class/BehaviorSubject

---

### 4. PostgreSQL Cascade Deletion Strategies

**Decision**: Use `onDelete: 'SET NULL'` for note-conversation FK; `onDelete: 'CASCADE'` for junction tables only

**Rationale**:
- **Note deletion**: Automatically removes note from conversation (SET NULL on `conversationId`) + cascades junction table cleanup
- **Conversation deletion**: Sets all child notes' `conversationId` to NULL (makes them standalone)
- **Category deletion**: Cascades only junction table entries (notes/conversations preserved, just lose the category tag)
- Preserves data by default, only removes relationships

**Implementation**:
```typescript
// Note entity
@ManyToOne(() => Conversation, conversation => conversation.notes, {
  onDelete: 'SET NULL',
  nullable: true
})
@JoinColumn({ name: 'conversationId' })
conversation: Conversation | null;

// TypeORM auto-handles junction table cascades
@ManyToMany(() => Category, category => category.notes, {
  cascade: ['insert', 'update'],
  onDelete: 'CASCADE'  // Applied to junction table only
})
@JoinTable({ name: 'note_categories' })
categories: Category[];
```

**Cascade Decision Matrix**:

| Operation | Effect | Cascade Strategy |
|-----------|--------|------------------|
| Delete note in conversation | Note deleted, conversation updated | `SET NULL` on FK + junction CASCADE |
| Delete conversation | Notes become standalone | `SET NULL` on FK |
| Delete category | Notes/conversations keep other categories | Junction CASCADE only |
| Delete user | All user data deleted | `CASCADE` on user FK (global) |

**Alternatives Considered**:
- `onDelete: 'RESTRICT'`: Rejected (would prevent deletions, require manual cleanup)
- Soft deletes: Rejected (spec calls for permanent deletion, simpler implementation)
- Manual cascade handling in service layer: Rejected (error-prone, database handles it better)

**References**:
- TypeORM Cascade Options: https://typeorm.io/relations#cascades
- PostgreSQL Foreign Keys: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK

---

### 5. System vs User Categories Implementation

**Decision**: Enum `type` field ('system' | 'user') + `userId` nullable FK + unique constraint on (name, userId, type)

**Rationale**:
- Single Category table simplifies queries (no joins for "all available categories")
- `type` enum distinguishes ownership clearly
- `userId` NULL for system categories, populated for user categories
- Unique constraint prevents duplicate names per user/scope
- Seed data via TypeORM migration for system categories

**Schema**:
```typescript
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ['system', 'user'] })
  type: 'system' | 'user';

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Index(['name', 'userId', 'type'], { unique: true })
  // Unique constraint
}
```

**Seed Data Approach**:
```typescript
// Migration: Insert system categories
await queryRunner.query(`
  INSERT INTO categories (id, name, type, "userId", "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid(), 'Work', 'system', NULL, NOW(), NOW()),
    (gen_random_uuid(), 'Personal', 'system', NULL, NOW(), NOW()),
    (gen_random_uuid(), 'Ideas', 'system', NULL, NOW(), NOW()),
    (gen_random_uuid(), 'Tasks', 'system', NULL, NOW(), NOW()),
    (gen_random_uuid(), 'Reference', 'system', NULL, NOW(), NOW())
  ON CONFLICT DO NOTHING;
`);
```

**Alternatives Considered**:
- Separate SystemCategory and UserCategory tables: Rejected (complex queries, duplicate code)
- Boolean `isSystem` flag: Rejected (enum is more explicit, easier to extend)
- No distinction (all user-owned): Rejected (loses "common categories" UX benefit)

**References**:
- TypeORM Enum Columns: https://typeorm.io/entities#enum-column-type
- PostgreSQL Enum Types: https://www.postgresql.org/docs/current/datatype-enum.html

---

## Deferred Decisions (Low Impact - Defaults Chosen)

| Decision | Default Choice | Rationale | Can Change Later? |
|----------|---------------|-----------|-------------------|
| Note ordering in conversations | Chronological (createdAt ASC) | Matches chat/timeline UX expectations | Yes - add manual ordering field |
| Delete confirmation dialogs | Yes (frontend only) | Industry UX best practice | Yes - controlled by frontend only |
| Delete type | Permanent (hard delete) | Matches spec, simpler implementation | Yes - add deletedAt column for soft delete |
| Edit history tracking | Track `updatedAt` only | Sufficient for MVP, avoids complexity | Yes - add audit log table later |
| Conversation deletion behavior | SET NULL (notes become standalone) | Consistent with note-conversation removal logic | No - changing would require data migration |
| Category deletion behavior | Remove junction entries only | Preserves notes/conversations (data safety) | No - changing would require data migration |

---

## Summary

All critical technical unknowns have been researched and resolved with clear patterns and rationale. The decisions align with:
- TypeORM best practices and existing mynotes patterns
- NestJS architectural conventions
- Angular 19 standalone component architecture
- PostgreSQL referential integrity capabilities
- RESTful API design principles

**Status**: ✅ Ready for Phase 1 (Design & Contracts)

**Next Steps**: Generate data-model.md, API contracts, and quickstart.md based on these research findings.
