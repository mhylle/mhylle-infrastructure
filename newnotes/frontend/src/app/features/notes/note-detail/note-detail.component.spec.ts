import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError, Observable } from 'rxjs';
import { signal } from '@angular/core';

import { NoteDetailComponent } from './note-detail.component';
import { NotesApiService } from '../../../core/services/notes-api.service';
import { TasksApiService } from '../../../core/services/tasks-api.service';
import { Note } from '../../../core/models/note.model';
import { Task, TaskStatus, TaskPriority } from '../../../core/models/task.model';

describe('NoteDetailComponent', () => {
  let component: NoteDetailComponent;
  let fixture: ComponentFixture<NoteDetailComponent>;
  let mockNotesApiService: jasmine.SpyObj<NotesApiService>;
  let mockTasksApiService: jasmine.SpyObj<TasksApiService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;
  let mockDialog: jasmine.SpyObj<MatDialog>;

  const mockNote: Note = {
    id: '123',
    content: 'Test note content',
    raw_content: 'Test note raw content',
    created_at: new Date('2025-10-28T10:30:00.000Z'),
    updated_at: new Date('2025-10-30T14:15:00.000Z'),
    source: 'text',
    metadata: {
      taskCount: 3
    }
  };

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      note_id: '123',
      title: 'Test task 1',
      description: 'Test description 1',
      priority: TaskPriority.HIGH,
      status: TaskStatus.PENDING,
      created_at: '2025-10-31T10:00:00.000Z',
      updated_at: '2025-10-31T10:00:00.000Z'
    },
    {
      id: 'task-2',
      note_id: '123',
      title: 'Test task 2',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.COMPLETED,
      completed_at: '2025-10-31T12:00:00.000Z',
      created_at: '2025-10-31T10:00:00.000Z',
      updated_at: '2025-10-31T12:00:00.000Z'
    }
  ];

  beforeEach(async () => {
    // Create spies for all services
    mockNotesApiService = jasmine.createSpyObj('NotesApiService', ['getNoteById', 'deleteNote']);
    mockTasksApiService = jasmine.createSpyObj('TasksApiService', ['getTasksByNoteId', 'updateTaskStatus']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate', 'createUrlTree', 'serializeUrl']);
    mockRouter.navigate.and.returnValue(Promise.resolve(true)); // Make navigate return a Promise
    mockRouter.createUrlTree.and.returnValue({} as any); // Mock createUrlTree for RouterLink
    mockRouter.serializeUrl.and.returnValue('/tasks?noteId=123'); // Mock serializeUrl for RouterLink
    mockDialog = jasmine.createSpyObj('MatDialog', ['open']);

    // Mock ActivatedRoute with paramMap
    mockActivatedRoute = {
      paramMap: of({
        get: (key: string) => key === 'id' ? '123' : null
      })
    };

    await TestBed.configureTestingModule({
      imports: [NoteDetailComponent],
      providers: [
        { provide: NotesApiService, useValue: mockNotesApiService },
        { provide: TasksApiService, useValue: mockTasksApiService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: MatDialog, useValue: mockDialog }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NoteDetailComponent);
    component = fixture.componentInstance;
  });

  /**
   * Test 1: Component Creation
   * Verifies that the component can be instantiated successfully
   */
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Test 2: Load Note on Init with Valid ID
   * Verifies that the component loads note data when initialized with a valid ID
   */
  it('should load note on init with valid ID', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    fixture.detectChanges(); // Triggers ngOnInit

    // Wait for async operations
    setTimeout(() => {
      expect(mockNotesApiService.getNoteById).toHaveBeenCalledWith('123');
      expect(component.note()).toEqual(mockNote);
      expect(component.noteId()).toBe('123');
      expect(component.loading()).toBe(false);
      expect(component.error()).toBeNull();
      done();
    }, 100);
  });

  /**
   * Test 3: Display Note Content
   * Verifies that note content is properly displayed in the template
   */
  it('should display note content', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of([]));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges(); // Update view with loaded data

      const compiled = fixture.nativeElement;
      const contentElement = compiled.querySelector('.note-content');

      expect(contentElement).toBeTruthy();
      expect(contentElement.textContent).toContain(mockNote.content);
      done();
    }, 100);
  });

  /**
   * Test 4: Display Metadata
   * Verifies that note metadata (created date, updated date, source) is displayed correctly
   */
  it('should display metadata (created, updated dates, source)', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const metadataSection = compiled.querySelector('.metadata-section');

      expect(metadataSection).toBeTruthy();
      expect(component.createdDate()).toBeTruthy();
      expect(component.updatedDate()).toBeTruthy();
      expect(component.note()?.source).toBe('text');
      expect(component.taskCount()).toBe(3);
      done();
    }, 100);
  });

  /**
   * Test 5: Handle Loading State
   * Verifies that loading indicator is shown while fetching note data
   */
  it('should handle loading state', (done) => {
    // Set up service to delay response slightly
    let resolvePromise: any;
    const delayedObservable = new Observable<Note>(subscriber => {
      resolvePromise = () => {
        subscriber.next(mockNote);
        subscriber.complete();
      };
    });

    mockNotesApiService.getNoteById.and.returnValue(delayedObservable);

    fixture.detectChanges(); // Triggers ngOnInit

    // Check that loading is initially true during API call
    expect(component.loading()).toBe(true);

    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    const spinner = compiled.querySelector('mat-spinner');
    expect(spinner).toBeTruthy();

    // Now resolve the observable
    resolvePromise();

    // Wait for async completion
    setTimeout(() => {
      expect(component.loading()).toBe(false);
      done();
    }, 50);
  });

  /**
   * Test 6: Handle 404 Error (Note Not Found)
   * Verifies that component handles 404 error gracefully with appropriate message
   */
  it('should handle 404 error (note not found)', (done) => {
    const notFoundError = { status: 404, message: 'Note not found' };
    mockNotesApiService.getNoteById.and.returnValue(throwError(() => notFoundError));

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.loading()).toBe(false);
      expect(component.error()).toBe('Note not found');
      expect(component.note()).toBeNull();

      fixture.detectChanges();
      const compiled = fixture.nativeElement;
      const errorMessage = compiled.querySelector('.error-message');
      expect(errorMessage?.textContent).toContain('Note not found');
      done();
    }, 100);
  });

  /**
   * Test 7: Handle Network Error
   * Verifies that component handles network errors gracefully
   */
  it('should handle network error', (done) => {
    const networkError = { status: 0, message: 'Network error' };
    mockNotesApiService.getNoteById.and.returnValue(throwError(() => networkError));

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.loading()).toBe(false);
      expect(component.error()).toBeTruthy();
      expect(component.error()).toContain('Failed to load note');
      done();
    }, 100);
  });

  /**
   * Test 8: Edit Button Navigation
   * Verifies that clicking edit button navigates to editor with note ID
   */
  it('should navigate to editor when edit button is clicked', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    fixture.detectChanges();

    setTimeout(() => {
      component.onEdit();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/notes', 'edit', '123']);
      done();
    }, 100);
  });

  /**
   * Test 9: Delete Button Shows Confirmation Dialog
   * Verifies that clicking delete button opens confirmation dialog
   */
  it('should show confirmation dialog when delete button is clicked', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    const mockDialogRef = {
      afterClosed: jasmine.createSpy('afterClosed').and.returnValue(of(false))
    } as any;

    mockDialog.open.and.returnValue(mockDialogRef);

    fixture.detectChanges();

    setTimeout(() => {
      component.onDelete();

      // Wait for dialog to process
      setTimeout(() => {
        expect(mockDialog.open).toHaveBeenCalled();
        const dialogConfig = mockDialog.open.calls.mostRecent().args[1] as any;
        expect(dialogConfig?.data).toBeDefined();
        expect(dialogConfig?.data?.title).toBe('Delete Note');
        expect(dialogConfig?.data?.message).toContain('Are you sure');
        done();
      }, 50);
    }, 100);
  });

  /**
   * Test 10: Delete Confirmation Calls API and Navigates
   * Verifies that confirming deletion calls API and navigates to list
   */
  it('should delete note and navigate to list when confirmed', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));
    mockNotesApiService.deleteNote.and.returnValue(of(undefined));

    const mockDialogRef = {
      afterClosed: jasmine.createSpy('afterClosed').and.returnValue(of(true))
    } as any;

    mockDialog.open.and.returnValue(mockDialogRef);

    fixture.detectChanges();

    setTimeout(() => {
      component.onDelete();

      // Wait for dialog close and delete operation
      setTimeout(() => {
        expect(mockNotesApiService.deleteNote).toHaveBeenCalledWith('123');
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/notes'], {
          state: { message: 'Note deleted successfully' }
        });
        done();
      }, 200);
    }, 100);
  });

  /**
   * Test 11: Delete Cancellation Does Nothing
   * Verifies that canceling deletion does not call API or navigate
   */
  it('should do nothing when delete is cancelled', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    const mockDialogRef = {
      afterClosed: jasmine.createSpy('afterClosed').and.returnValue(of(false))
    } as any;

    mockDialog.open.and.returnValue(mockDialogRef);

    fixture.detectChanges();

    setTimeout(() => {
      component.onDelete();

      setTimeout(() => {
        expect(mockNotesApiService.deleteNote).not.toHaveBeenCalled();
        expect(mockRouter.navigate).not.toHaveBeenCalled();
        done();
      }, 200);
    }, 100);
  });

  /**
   * Test 12: Back Button Navigation
   * Verifies that clicking back button navigates to notes list
   */
  it('should navigate to list when back button is clicked', () => {
    component.onBack();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/notes']);
  });

  /**
   * Test 13: Computed Signal - hasBeenUpdated
   * Verifies that hasBeenUpdated computed signal works correctly
   */
  it('should correctly compute hasBeenUpdated', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.hasBeenUpdated()).toBe(true);

      // Test with note that hasn't been updated
      const unchangedNote: Note = {
        ...mockNote,
        created_at: new Date('2025-10-28T10:30:00.000Z'),
        updated_at: new Date('2025-10-28T10:30:00.000Z')
      };

      mockNotesApiService.getNoteById.and.returnValue(of(unchangedNote));
      component.ngOnInit();

      setTimeout(() => {
        expect(component.hasBeenUpdated()).toBe(false);
        done();
      }, 100);
    }, 100);
  });

  /**
   * Test 14: Computed Signal - taskCount
   * Verifies that taskCount computed signal returns correct value
   */
  it('should correctly compute taskCount', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.taskCount()).toBe(3);

      // Test with note without taskCount
      const noteWithoutTasks: Note = {
        ...mockNote,
        metadata: {}
      };

      mockNotesApiService.getNoteById.and.returnValue(of(noteWithoutTasks));
      component.ngOnInit();

      setTimeout(() => {
        expect(component.taskCount()).toBe(0);
        done();
      }, 100);
    }, 100);
  });

  /**
   * Test 15: Date Formatting
   * Verifies that dates are formatted correctly
   */
  it('should format dates correctly', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of([]));

    fixture.detectChanges();

    setTimeout(() => {
      const createdDate = component.createdDate();
      const updatedDate = component.updatedDate();

      expect(createdDate).toBeTruthy();
      expect(updatedDate).toBeTruthy();
      expect(createdDate).toMatch(/\w{3} \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM)/);
      expect(updatedDate).toMatch(/\w{3} \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM)/);
      done();
    }, 100);
  });

  /**
   * Test 16: Load Tasks for Note
   * Verifies that tasks are loaded when note is loaded
   */
  it('should load tasks after note is loaded', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    fixture.detectChanges();

    setTimeout(() => {
      expect(mockTasksApiService.getTasksByNoteId).toHaveBeenCalledWith('123');
      expect(component.tasks().length).toBe(2);
      expect(component.tasksLoading()).toBe(false);
      expect(component.tasksError()).toBeNull();
      done();
    }, 100);
  });

  /**
   * Test 17: Display Task List When Tasks Exist
   * Verifies that task list is displayed when tasks are loaded
   */
  it('should display task list when tasks exist', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();

      expect(component.totalTasks()).toBe(2);
      expect(component.completedTasks()).toBe(1);
      expect(component.tasksByStatus().pending.length).toBe(1);
      expect(component.tasksByStatus().completed.length).toBe(1);
      done();
    }, 100);
  });

  /**
   * Test 18: Show Empty State When No Tasks
   * Verifies that empty state message is shown when no tasks exist
   */
  it('should show empty state when no tasks', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of([]));

    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();

      expect(component.tasks().length).toBe(0);
      expect(component.totalTasks()).toBe(0);
      expect(component.completedTasks()).toBe(0);
      done();
    }, 100);
  });

  /**
   * Test 19: Toggle Task Status
   * Verifies that task status can be toggled
   */
  it('should toggle task status from pending to completed', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    const updatedTask = { ...mockTasks[0], status: TaskStatus.COMPLETED };
    mockTasksApiService.updateTaskStatus.and.returnValue(of(updatedTask));

    fixture.detectChanges();

    setTimeout(() => {
      const task = component.tasks()[0];

      // Setup fresh tasks response after update
      mockTasksApiService.getTasksByNoteId.and.returnValue(of([updatedTask, mockTasks[1]]));

      component.toggleTaskStatus(task);

      setTimeout(() => {
        expect(mockTasksApiService.updateTaskStatus).toHaveBeenCalledWith('task-1', { status: TaskStatus.COMPLETED });
        expect(mockTasksApiService.getTasksByNoteId).toHaveBeenCalledTimes(2);
        done();
      }, 100);
    }, 100);
  });

  /**
   * Test 20: Handle Task Loading Error
   * Verifies that task loading errors are handled gracefully
   */
  it('should handle task loading error', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));
    const taskError = { status: 500, message: 'Server error' };
    mockTasksApiService.getTasksByNoteId.and.returnValue(throwError(() => taskError));

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.tasksLoading()).toBe(false);
      expect(component.tasksError()).toBe('Failed to load tasks');
      expect(component.tasks().length).toBe(0);
      done();
    }, 100);
  });

  /**
   * Test 21: Handle Task Status Update Error
   * Verifies that task status update errors are handled gracefully
   */
  it('should handle task status update error', (done) => {
    mockNotesApiService.getNoteById.and.returnValue(of(mockNote));
    mockTasksApiService.getTasksByNoteId.and.returnValue(of(mockTasks));

    const updateError = { status: 500, message: 'Server error' };
    mockTasksApiService.updateTaskStatus.and.returnValue(throwError(() => updateError));

    fixture.detectChanges();

    setTimeout(() => {
      const task = component.tasks()[0];
      component.toggleTaskStatus(task);

      setTimeout(() => {
        expect(component.tasksError()).toBe('Failed to update task status');
        done();
      }, 100);
    }, 100);
  });
});
