# Note Editor Edit Mode Requirements

## Current State

The NoteEditorComponent currently supports **create mode only**:
- Hardcoded "Create Note" title in template
- Hardcoded "Save Note" button text
- Single `content` signal for user input
- `saveNote()` method always calls `createNote()` API
- No route parameter handling
- No data loading on component initialization
- No edit mode detection

## Required Changes

### 1. Route Detection

**How to detect edit mode:**
- Inject `ActivatedRoute` from `@angular/router`
- Read route parameter in constructor/ngOnInit using `ActivatedRoute.snapshot.paramMap.get('id')`
- Route pattern: `/notes/edit/:id` for edit mode vs `/notes/new` for create mode

**What parameter to read:**
- Parameter name: `id` (note ID as UUID string)
- Presence of `id` parameter indicates edit mode
- Absence of `id` parameter indicates create mode

### 2. Data Loading

**What API method to call:**
- `NotesApiService.getNoteById(id: string): Observable<Note>`
- API endpoint: `GET /api/notes/:id`

**When to call it:**
- In `ngOnInit()` lifecycle hook (component needs to implement `OnInit`)
- Only call when `noteId` signal has a value (edit mode detected)

**What data to populate:**
- Populate `content` signal with `note.content` from API response
- Store `noteId` for later use in update operation
- Handle loading state with new `loading` signal
- Handle error state if note not found or API fails

### 3. Save Logic

**Create vs Update branching:**
```typescript
if (this.noteId()) {
  // Edit mode - call updateNote
  this.notesService.updateNote(this.noteId(), { content: trimmedContent })
} else {
  // Create mode - call createNote
  this.notesService.createNote({ content: trimmedContent })
}
```

**API methods to use:**
- **Create**: `createNote(dto: CreateNoteDto): Observable<Note>` - POST request
- **Update**: `updateNote(id: string, dto: Partial<CreateNoteDto>): Observable<Note>` - PATCH request

### 4. UI Updates

**Title changes:**
- Current: Hardcoded "Create Note"
- Required: Dynamic title using computed signal or template logic
  - Create mode: "Create Note"
  - Edit mode: "Edit Note"

**Button text changes:**
- Current: Hardcoded "Save Note"
- Required: Dynamic button text
  - Create mode: "Save Note"
  - Edit mode: "Update Note"

**Additional UI considerations:**
- Show loading spinner while fetching note data in edit mode
- Display error message if note fails to load
- Disable form fields during initial data loading

## Implementation Checklist

### Component Class Changes
- [ ] Import `OnInit` interface and implement it
- [ ] Inject `ActivatedRoute` in constructor
- [ ] Add `noteId = signal<string | null>(null)` property
- [ ] Add `isEditMode = computed(() => !!this.noteId())` computed signal
- [ ] Add `loading = signal(false)` for initial data load state
- [ ] Add `ngOnInit()` lifecycle method
- [ ] In `ngOnInit()`: Read route parameter and store in `noteId` signal
- [ ] In `ngOnInit()`: Call `loadNote()` if `noteId` exists
- [ ] Create `loadNote()` method to fetch note data via `getNoteById()`
- [ ] Update `saveNote()` to branch on `isEditMode()`:
  - If true: call `updateNote(noteId, dto)`
  - If false: call `createNote(dto)`

### Template Changes
- [ ] Update `<h2>` title to use conditional logic: `{{ isEditMode() ? 'Edit Note' : 'Create Note' }}`
- [ ] Update save button text to use conditional logic: `{{ isEditMode() ? 'Update Note' : 'Save Note' }}`
- [ ] Add loading spinner/state display while fetching note in edit mode
- [ ] Consider disabling form during initial load: `[disabled]="saving() || loading()"`

### Error Handling
- [ ] Handle 404 error if note not found (redirect to notes list)
- [ ] Handle network errors during note loading
- [ ] Display appropriate error messages for load vs save failures
- [ ] Clear previous errors when switching between operations

### Navigation Considerations
- [ ] Verify route configuration supports `/notes/edit/:id` pattern
- [ ] Ensure navigation from notes list passes correct note ID
- [ ] Both create and edit modes navigate back to `/notes` on success

## API Methods Available

**From NotesApiService:**
1. `getNotes(): Observable<Note[]>` - List all notes
2. `createNote(dto: CreateNoteDto): Observable<Note>` - Create new note
3. `getNoteById(id: string): Observable<Note>` - Fetch single note by ID ✓ **AVAILABLE**
4. `updateNote(id: string, dto: Partial<CreateNoteDto>): Observable<Note>` - Update note ✓ **AVAILABLE**
5. `deleteNote(id: string): Observable<void>` - Delete note

**Conclusion:** All required API methods (`getNoteById` and `updateNote`) are already implemented in the service.

## What's Missing in Current Component

1. **Route parameter handling** - No `ActivatedRoute` injection or parameter reading
2. **Edit mode detection** - No logic to determine if creating or editing
3. **Data loading** - No method to fetch existing note data
4. **Conditional API calls** - `saveNote()` always creates, never updates
5. **Dynamic UI** - Title and button text are hardcoded for create mode
6. **Loading state** - No signal to track initial data fetch
7. **OnInit lifecycle** - Component doesn't implement `OnInit` for initialization logic

## Key Changes Needed

**Core Logic:**
- Add route parameter detection using `ActivatedRoute`
- Implement `ngOnInit()` to load note data when in edit mode
- Branch `saveNote()` logic between `createNote()` and `updateNote()` based on mode

**State Management:**
- Add `noteId` signal to track which note is being edited
- Add `isEditMode` computed signal for cleaner conditional logic
- Add `loading` signal for initial data fetch state

**UI Updates:**
- Make title dynamic: "Create Note" vs "Edit Note"
- Make button text dynamic: "Save Note" vs "Update Note"
- Handle loading state during data fetch in edit mode
