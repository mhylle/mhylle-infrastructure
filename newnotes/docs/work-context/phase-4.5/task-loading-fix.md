# Task Loading Fix - Phase 4.5

## Issue Summary

Tasks were being successfully extracted and saved in the backend, but the frontend Note Detail component was showing "Failed to load tasks" error.

## Root Cause

The `TasksApiService.getTasksByNoteId()` method was constructing an incorrect API endpoint URL.

**Incorrect URL**: `${this.notesApiUrl}/${noteId}/tasks`
- This resulted in: `http://localhost:3005/api/notes/{noteId}/tasks`

**Correct URL**: `${this.notesApiUrl}/tasks/note/${noteId}`
- This results in: `http://localhost:3005/api/notes/tasks/note/{noteId}`

The backend route defined in `tasks.controller.ts` line 82 is:
```typescript
@Get('note/:noteId')
async findByNoteId(@Param('noteId') noteId: string): Promise<Task[]>
```

This creates the route `/api/notes/tasks/note/:noteId`, which requires the `/tasks/note/` path before the noteId parameter.

## Files Changed

### 1. `/home/mhylle/projects/mhylle.com/newnotes/frontend/src/app/core/services/tasks-api.service.ts`

**Change**: Fixed the endpoint URL construction in `getTasksByNoteId()` method

```typescript
// Before
getTasksByNoteId(noteId: string): Observable<Task[]> {
  return this.http.get<Task[]>(`${this.notesApiUrl}/${noteId}/tasks`);
}

// After
getTasksByNoteId(noteId: string): Observable<Task[]> {
  return this.http.get<Task[]>(`${this.notesApiUrl}/tasks/note/${noteId}`);
}
```

### 2. `/home/mhylle/projects/mhylle.com/newnotes/frontend/src/app/features/notes/note-detail/note-detail.component.ts`

**Change**: Added console logging to `loadTasks()` method for debugging

```typescript
loadTasks(noteId: string): void {
  console.log('Loading tasks for note:', noteId);
  this.tasksLoading.set(true);
  this.tasksError.set(null);

  this.tasksApiService.getTasksByNoteId(noteId).subscribe({
    next: (tasks) => {
      console.log('Tasks loaded successfully:', tasks);
      this.tasks.set(tasks);
      this.tasksLoading.set(false);
    },
    error: (err) => {
      console.error('Failed to load tasks:', err);
      this.tasksLoading.set(false);
      this.tasksError.set('Failed to load tasks');
    }
  });
}
```

## Verification Results

### Browser Console Output
```
Loading tasks for note: 09041c62-873e-41a0-9248-354ede4a7d35
Tasks loaded successfully: [Object]
```

### Network Request
```
GET http://localhost:3005/api/notes/tasks/note/09041c62-873e-41a0-9248-354ede4a7d35
Status: 200 OK
```

### UI Verification

The Note Detail page now successfully displays:
- "Extracted Tasks (1)" header
- Task list with:
  - Task title: "Make breakfast"
  - Priority badge: "medium"
  - Status badge: "pending"
  - Checkbox for status toggle
- "View All Tasks" link

The error message "Failed to load tasks" no longer appears.

## Testing Performed

1. Navigated to http://localhost:4200
2. Clicked on a note with extracted tasks
3. Verified in Chrome DevTools:
   - Console shows successful task loading logs
   - Network tab shows 200 OK response from correct endpoint
   - UI displays tasks correctly without errors

## Conclusion

The issue was a simple URL construction error in the frontend service. The fix ensures the frontend correctly calls the backend endpoint `/api/notes/tasks/note/{noteId}` to retrieve tasks for a specific note. Tasks now load and display correctly in the Note Detail component.
