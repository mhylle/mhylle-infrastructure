# Note Detail Component Design

## Component Overview

The Note Detail Component provides a read-only view of a single note with full content display, metadata, and action buttons. This component serves as the primary viewing interface after users click a note card from the list view. It displays complete note content (no truncation), metadata including timestamps and source information, extracted task count, and provides navigation to edit mode, deletion functionality, and return to the list view.

**Primary Responsibilities**:
- Load and display full note content via API
- Show metadata (created date, updated date, source type)
- Display task extraction count if available
- Provide action buttons (Edit, Delete, Back)
- Handle loading and error states gracefully
- Confirm deletion before API call
- Navigate appropriately after actions

## Data Model

### Component Properties and Signals

```typescript
export class NoteDetailComponent {
  // Route parameter
  noteId = signal<string>('');

  // Core data
  note = signal<Note | null>(null);

  // State management
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Computed signals
  isLoaded = computed(() => this.note() !== null && !this.loading());
  hasError = computed(() => this.error() !== null);

  // Formatted metadata
  createdDate = computed(() => {
    const note = this.note();
    return note ? this.formatDate(note.created_at) : '';
  });

  updatedDate = computed(() => {
    const note = this.note();
    return note ? this.formatDate(note.updated_at) : '';
  });

  hasBeenUpdated = computed(() => {
    const note = this.note();
    if (!note) return false;
    return new Date(note.updated_at).getTime() > new Date(note.created_at).getTime();
  });

  taskCount = computed(() => {
    const note = this.note();
    return note?.metadata?.taskCount || 0;
  });
}
```

### Note Interface

```typescript
export interface Note {
  id: string;
  content: string;
  raw_content: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  source: string;
  metadata?: {
    taskCount?: number;
    [key: string]: any;
  };
}
```

### API Methods Required

```typescript
// From NotesService
getNoteById(id: string): Observable<Note>
deleteNote(id: string): Observable<void>
```

### Loading and Error States

**Loading State**:
- Display when `loading()` is `true`
- Show Material spinner in content area
- Disable all action buttons

**Error States**:
- **404 Not Found**: "Note not found" message with "Back to List" button
- **Network Error**: "Failed to load note" with "Retry" and "Back to List" buttons
- **Server Error**: "Server error occurred" with error details and "Back to List" button

## UI Layout

### Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [← Back to List]                            [Edit] [Delete] │ Header Actions
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                    Note Content Area                         │
│                                                               │
│   Full note content displayed here with proper              │
│   line breaks and formatting preserved.                     │
│                                                               │
│   Multiple paragraphs are properly spaced.                  │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ Metadata Section                                            │
│                                                               │
│ Created:  Oct 28, 2025 at 10:30 AM                         │
│ Updated:  Oct 30, 2025 at 2:15 PM  (if different)          │
│ Source:   text                                               │
│ Tasks:    3 extracted                     (if taskCount > 0) │
└─────────────────────────────────────────────────────────────┘
```

### Layout Sections

#### 1. Header Actions Bar
- **Left Side**: Back button with icon
- **Right Side**: Edit and Delete buttons
- Material toolbar or card header styling
- Sticky positioning for scroll scenarios

#### 2. Content Display Area
- White space preserved (`white-space: pre-wrap`)
- Proper line height for readability
- Adequate padding and margins
- Material card styling
- Scrollable if content exceeds viewport

#### 3. Metadata Section
- Clean label-value pairs
- Date formatting: "MMM DD, YYYY at HH:MM AM/PM"
- Only show "Updated" if different from "Created"
- Conditional task count display
- Subtle styling (grey text, smaller font)
- Divider line from content area

### Material Design Elements

- `mat-card` for main container
- `mat-toolbar` or card header for actions
- `mat-button` for Back button
- `mat-raised-button` for Edit and Delete
- `mat-icon` for button icons
- `mat-divider` between sections
- `mat-spinner` for loading state
- Typography classes for content and metadata

## User Actions

### 1. View Note Content
**Trigger**: Component loads with `:id` parameter
**Behavior**:
- Extract `id` from route params
- Call `notesService.getNoteById(id)`
- Set `loading(true)` during fetch
- Set `note()` on success
- Set `error()` on failure
- Set `loading(false)` when complete

### 2. Edit Note
**Trigger**: Click "Edit" button
**Behavior**:
- Navigate to `/notes/edit/:id`
- Pass current note ID
- No API call needed (editor will load note)

**Implementation**:
```typescript
onEdit(): void {
  this.router.navigate(['/notes', 'edit', this.noteId()]);
}
```

### 3. Delete Note
**Trigger**: Click "Delete" button
**Behavior**:
1. Open Material confirmation dialog
2. Dialog message: "Are you sure you want to delete this note? This action cannot be undone."
3. Dialog buttons: "Cancel" and "Delete"
4. If confirmed:
   - Call `notesService.deleteNote(id)`
   - Show loading state during deletion
   - On success: Navigate to `/notes` with success message
   - On error: Display error message, stay on page

**Implementation**:
```typescript
onDelete(): void {
  const dialogRef = this.dialog.open(ConfirmDialogComponent, {
    data: {
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      this.deleteNote();
    }
  });
}

private deleteNote(): void {
  this.loading.set(true);
  this.notesService.deleteNote(this.noteId())
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: () => {
        this.router.navigate(['/notes'], {
          state: { message: 'Note deleted successfully' }
        });
      },
      error: (err) => {
        this.error.set('Failed to delete note');
        this.loading.set(false);
      }
    });
}
```

### 4. Back to List
**Trigger**: Click "Back to List" button
**Behavior**:
- Navigate to `/notes`
- No API call needed
- Simple navigation action

**Implementation**:
```typescript
onBack(): void {
  this.router.navigate(['/notes']);
}
```

## Angular Modules Required

### Core Angular Modules
- `CommonModule` - Common directives (ngIf, ngFor)
- `RouterModule` - Route parameter access and navigation

### Angular Material Modules
- `MatCardModule` - Card container
- `MatButtonModule` - Action buttons
- `MatIconModule` - Icons in buttons
- `MatToolbarModule` - Header actions bar
- `MatDividerModule` - Section dividers
- `MatProgressSpinnerModule` - Loading state
- `MatDialogModule` - Confirmation dialog

### Services Required
- `NotesService` - API communication
- `Router` - Navigation
- `ActivatedRoute` - Route parameter access
- `MatDialog` - Dialog service

## Implementation Checklist

### Phase 1: Setup and Structure
- [ ] Create component files via Angular CLI
  ```bash
  ng generate component features/notes/components/note-detail --standalone
  ```
- [ ] Create confirmation dialog component
  ```bash
  ng generate component shared/components/confirm-dialog --standalone
  ```
- [ ] Update routing configuration
  ```typescript
  {
    path: 'notes/:id',
    component: NoteDetailComponent,
    canActivate: [AuthGuard]
  }
  ```

### Phase 2: Test-Driven Development
- [ ] Write component unit tests (TDD approach)
  - Test note loading from API
  - Test loading state display
  - Test error state handling
  - Test delete confirmation dialog
  - Test navigation actions
  - Test computed signals (dates, taskCount)
  - Test null/undefined note handling
- [ ] Write confirmation dialog tests
  - Test dialog opening
  - Test confirmation flow
  - Test cancellation flow

### Phase 3: TypeScript Implementation
- [ ] Implement component class
  - Define signals and computed properties
  - Implement `ngOnInit` to load note
  - Implement action handlers (edit, delete, back)
  - Add date formatting utility
  - Add error handling
- [ ] Implement confirmation dialog
  - Accept data input
  - Return confirmation result
  - Style with Material Design

### Phase 4: HTML Template
- [ ] Create header actions bar
  - Back button with icon
  - Edit button with icon
  - Delete button with icon
- [ ] Create content display area
  - Show loading spinner when `loading()`
  - Display note content when `isLoaded()`
  - Show error message when `hasError()`
- [ ] Create metadata section
  - Created date display
  - Conditional updated date
  - Source type display
  - Conditional task count
- [ ] Add confirmation dialog template
  - Title display
  - Message display
  - Action buttons

### Phase 5: CSS Styling
- [ ] Style header actions bar
  - Proper spacing and alignment
  - Responsive layout
  - Hover states
- [ ] Style content area
  - Typography and line height
  - White space preservation
  - Padding and margins
- [ ] Style metadata section
  - Label-value pairs
  - Subtle styling (grey text)
  - Proper spacing
- [ ] Style confirmation dialog
  - Center alignment
  - Proper button styling
  - Material theme integration

### Phase 6: Integration
- [ ] Update app routing module
- [ ] Ensure NotesService is provided
- [ ] Test navigation from list component
- [ ] Test navigation to edit component
- [ ] Verify API integration

### Phase 7: End-to-End Testing
- [ ] Test complete view flow
  - Navigate from list to detail
  - Verify content displays correctly
  - Verify metadata displays correctly
- [ ] Test edit navigation
  - Click edit button
  - Verify navigation to editor
- [ ] Test delete flow
  - Click delete button
  - Verify confirmation dialog
  - Confirm deletion
  - Verify navigation to list
- [ ] Test error scenarios
  - Invalid note ID (404)
  - Network errors
  - API errors
- [ ] Test responsive design
  - Mobile viewport
  - Tablet viewport
  - Desktop viewport

## Component File Structure

```
frontend/src/app/features/notes/components/note-detail/
├── note-detail.component.ts       # Component logic
├── note-detail.component.html     # Template
├── note-detail.component.scss     # Styles
└── note-detail.component.spec.ts  # Unit tests
```

## Navigation Integration

### Route Configuration
```typescript
{
  path: 'notes/:id',
  component: NoteDetailComponent,
  canActivate: [AuthGuard]
}
```

### Navigation Targets
- **From**: List component (card click)
- **To Edit**: `/notes/edit/:id` (edit button)
- **To List**: `/notes` (back button, after delete)

## Error Handling Strategy

### Error Types and Responses

| Error Type | Status | Display | Actions |
|------------|--------|---------|---------|
| Not Found | 404 | "Note not found" | Back to List |
| Network Error | 0 | "Failed to load note" | Retry, Back to List |
| Server Error | 500 | "Server error occurred" | Back to List |
| Unauthorized | 401 | Redirect to login | None |

### Error Display Component
```html
<mat-card *ngIf="hasError()">
  <mat-card-content>
    <p class="error-message">{{ error() }}</p>
    <div class="error-actions">
      <button mat-raised-button (click)="loadNote()">Retry</button>
      <button mat-button (click)="onBack()">Back to List</button>
    </div>
  </mat-card-content>
</mat-card>
```

## Accessibility Considerations

- **Keyboard Navigation**: All actions accessible via keyboard
- **Screen Readers**: Proper ARIA labels on buttons and sections
- **Focus Management**: Restore focus after dialog closes
- **Loading States**: Announce loading state to screen readers
- **Error Messages**: Announce errors to screen readers

## Performance Considerations

- **API Caching**: Consider caching note data in service
- **Signal-Based Reactivity**: Efficient change detection
- **Lazy Loading**: Component loaded only when route active
- **Computed Signals**: Minimize recalculation of derived values

## Future Enhancements

- **Task List Display**: Show extracted tasks inline
- **Edit History**: Display edit timestamps and versions
- **Share Functionality**: Share note via link or export
- **Print View**: Optimized printing layout
- **Markdown Support**: Render markdown if content contains markdown syntax
