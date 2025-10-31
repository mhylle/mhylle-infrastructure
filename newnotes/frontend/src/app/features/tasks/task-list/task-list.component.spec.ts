import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TaskListComponent } from './task-list.component';
import { TasksApiService } from '../../../core/services/tasks-api.service';
import { of, throwError } from 'rxjs';
import { Task, TaskStatus, TaskPriority } from '../../../core/models/task.model';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('TaskListComponent', () => {
  let component: TaskListComponent;
  let fixture: ComponentFixture<TaskListComponent>;
  let mockTasksApiService: jasmine.SpyObj<TasksApiService>;
  let matDialog: MatDialog;

  const mockTasks: Task[] = [
    {
      id: '1',
      note_id: 'note-1',
      title: 'Test Task 1',
      description: 'Description 1',
      priority: TaskPriority.HIGH,
      status: TaskStatus.PENDING,
      due_date: '2025-11-01T00:00:00.000Z',
      created_at: '2025-10-31T10:00:00.000Z',
      updated_at: '2025-10-31T10:00:00.000Z'
    },
    {
      id: '2',
      note_id: 'note-1',
      title: 'Test Task 2',
      description: 'Description 2',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.IN_PROGRESS,
      due_date: '2025-11-02T00:00:00.000Z',
      created_at: '2025-10-31T11:00:00.000Z',
      updated_at: '2025-10-31T11:00:00.000Z'
    },
    {
      id: '3',
      note_id: 'note-2',
      title: 'Test Task 3',
      description: 'Description 3',
      priority: TaskPriority.LOW,
      status: TaskStatus.COMPLETED,
      due_date: '2025-11-03T00:00:00.000Z',
      completed_at: '2025-10-31T12:00:00.000Z',
      created_at: '2025-10-31T09:00:00.000Z',
      updated_at: '2025-10-31T12:00:00.000Z'
    }
  ];

  beforeEach(async () => {
    mockTasksApiService = jasmine.createSpyObj('TasksApiService', [
      'getTasks',
      'updateTaskStatus',
      'deleteTask'
    ]);

    await TestBed.configureTestingModule({
      imports: [TaskListComponent, NoopAnimationsModule],
      providers: [
        { provide: TasksApiService, useValue: mockTasksApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskListComponent);
    component = fixture.componentInstance;
    matDialog = TestBed.inject(MatDialog);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should initialize with default values', () => {
      expect(component.tasks()).toEqual([]);
      expect(component.loading()).toBe(true);
      expect(component.error()).toBeNull();
      expect(component.selectedStatus()).toBe('all');
      expect(component.selectedPriority()).toBe('all');
      expect(component.noteIdFilter()).toBeNull();
    });

    it('should load tasks on initialization', () => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));

      fixture.detectChanges(); // Triggers ngOnInit

      expect(mockTasksApiService.getTasks).toHaveBeenCalled();
      expect(component.tasks()).toEqual(mockTasks);
      expect(component.loading()).toBe(false);
      expect(component.error()).toBeNull();
    });
  });

  describe('Loading Tasks', () => {
    it('should load tasks successfully', () => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));

      component.loadTasks();

      expect(component.loading()).toBe(false);
      expect(component.tasks()).toEqual(mockTasks);
      expect(component.error()).toBeNull();
    });

    it('should handle loading error', () => {
      const errorMessage = 'Failed to load tasks';
      mockTasksApiService.getTasks.and.returnValue(
        throwError(() => new Error(errorMessage))
      );

      component.loadTasks();

      expect(component.loading()).toBe(false);
      expect(component.error()).toBe('Failed to load tasks');
      expect(component.tasks()).toEqual([]);
    });

    it('should load tasks filtered by noteId when noteIdFilter is set', () => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));
      component.noteIdFilter.set('note-1');

      component.loadTasks();

      expect(mockTasksApiService.getTasks).toHaveBeenCalledWith({ noteId: 'note-1' });
    });
  });

  describe('Status Filtering', () => {
    beforeEach(() => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));
      fixture.detectChanges();
    });

    it('should show all tasks when status filter is "all"', () => {
      component.selectedStatus.set('all');
      expect(component.filteredTasks().length).toBe(3);
    });

    it('should filter tasks by pending status', () => {
      component.selectedStatus.set(TaskStatus.PENDING);
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(1);
      expect(filtered[0].status).toBe(TaskStatus.PENDING);
    });

    it('should filter tasks by in_progress status', () => {
      component.selectedStatus.set(TaskStatus.IN_PROGRESS);
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(1);
      expect(filtered[0].status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should filter tasks by completed status', () => {
      component.selectedStatus.set(TaskStatus.COMPLETED);
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(1);
      expect(filtered[0].status).toBe(TaskStatus.COMPLETED);
    });

    it('should update filtered tasks when filterByStatus is called', () => {
      component.filterByStatus(TaskStatus.PENDING);
      expect(component.selectedStatus()).toBe(TaskStatus.PENDING);
      expect(component.filteredTasks().length).toBe(1);
    });
  });

  describe('Priority Filtering', () => {
    beforeEach(() => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));
      fixture.detectChanges();
    });

    it('should show all tasks when priority filter is "all"', () => {
      component.selectedPriority.set('all');
      expect(component.filteredTasks().length).toBe(3);
    });

    it('should filter tasks by high priority', () => {
      component.selectedPriority.set(TaskPriority.HIGH);
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(1);
      expect(filtered[0].priority).toBe(TaskPriority.HIGH);
    });

    it('should filter tasks by medium priority', () => {
      component.selectedPriority.set(TaskPriority.MEDIUM);
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(1);
      expect(filtered[0].priority).toBe(TaskPriority.MEDIUM);
    });

    it('should filter tasks by low priority', () => {
      component.selectedPriority.set(TaskPriority.LOW);
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(1);
      expect(filtered[0].priority).toBe(TaskPriority.LOW);
    });

    it('should update filtered tasks when filterByPriority is called', () => {
      component.filterByPriority(TaskPriority.HIGH);
      expect(component.selectedPriority()).toBe(TaskPriority.HIGH);
      expect(component.filteredTasks().length).toBe(1);
    });
  });

  describe('Combined Filtering', () => {
    beforeEach(() => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));
      fixture.detectChanges();
    });

    it('should filter by both status and priority', () => {
      component.selectedStatus.set(TaskStatus.PENDING);
      component.selectedPriority.set(TaskPriority.HIGH);
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(1);
      expect(filtered[0].status).toBe(TaskStatus.PENDING);
      expect(filtered[0].priority).toBe(TaskPriority.HIGH);
    });

    it('should filter by status, priority, and noteId', () => {
      component.selectedStatus.set(TaskStatus.PENDING);
      component.selectedPriority.set(TaskPriority.HIGH);
      component.noteIdFilter.set('note-1');
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(1);
      expect(filtered[0].note_id).toBe('note-1');
    });

    it('should return empty array when no tasks match filters', () => {
      component.selectedStatus.set(TaskStatus.CANCELLED);
      expect(component.filteredTasks().length).toBe(0);
    });
  });

  describe('Task Status Update', () => {
    beforeEach(() => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));
      fixture.detectChanges();
    });

    it('should update task status successfully', () => {
      const task = mockTasks[0];
      const updatedTask = { ...task, status: TaskStatus.COMPLETED };
      mockTasksApiService.updateTaskStatus.and.returnValue(of(updatedTask));
      mockTasksApiService.getTasks.and.returnValue(of([updatedTask, mockTasks[1], mockTasks[2]]));

      component.updateTaskStatus(task, TaskStatus.COMPLETED);

      expect(mockTasksApiService.updateTaskStatus).toHaveBeenCalledWith(
        task.id,
        { status: TaskStatus.COMPLETED }
      );
      expect(mockTasksApiService.getTasks).toHaveBeenCalled();
    });

    it('should handle update error', () => {
      const task = mockTasks[0];
      mockTasksApiService.updateTaskStatus.and.returnValue(
        throwError(() => new Error('Update failed'))
      );

      component.updateTaskStatus(task, TaskStatus.COMPLETED);

      expect(component.error()).toBe('Failed to update task status');
    });
  });

  describe('Task Deletion', () => {
    beforeEach(() => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));
      fixture.detectChanges();
    });

    it('should delete task after confirmation', fakeAsync(() => {
      const task = mockTasks[0];
      const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
      dialogRefSpy.afterClosed.and.returnValue(of(true));
      spyOn(matDialog, 'open').and.returnValue(dialogRefSpy);

      mockTasksApiService.deleteTask.and.returnValue(of(void 0));
      mockTasksApiService.getTasks.and.returnValue(of([mockTasks[1], mockTasks[2]]));

      component.deleteTask(task);
      tick();

      expect(matDialog.open).toHaveBeenCalled();
      expect(mockTasksApiService.deleteTask).toHaveBeenCalledWith(task.id);
      expect(mockTasksApiService.getTasks).toHaveBeenCalled();
    }));

    it('should not delete task when confirmation is cancelled', fakeAsync(() => {
      const task = mockTasks[0];
      const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
      dialogRefSpy.afterClosed.and.returnValue(of(false));
      spyOn(matDialog, 'open').and.returnValue(dialogRefSpy);

      component.deleteTask(task);
      tick();

      expect(matDialog.open).toHaveBeenCalled();
      expect(mockTasksApiService.deleteTask).not.toHaveBeenCalled();
    }));

    it('should handle delete error', fakeAsync(() => {
      const task = mockTasks[0];
      const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
      dialogRefSpy.afterClosed.and.returnValue(of(true));
      spyOn(matDialog, 'open').and.returnValue(dialogRefSpy);

      mockTasksApiService.deleteTask.and.returnValue(
        throwError(() => new Error('Delete failed'))
      );

      component.deleteTask(task);
      tick();

      expect(component.error()).toBe('Failed to delete task');
    }));
  });

  describe('Refresh Tasks', () => {
    it('should reload tasks from API', () => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));

      component.refreshTasks();

      expect(mockTasksApiService.getTasks).toHaveBeenCalled();
      expect(component.tasks()).toEqual(mockTasks);
    });
  });

  describe('Note Filter Input', () => {
    it('should accept noteId input parameter', () => {
      component.noteIdFilter.set('test-note-id');
      expect(component.noteIdFilter()).toBe('test-note-id');
    });

    it('should filter tasks by noteId', () => {
      mockTasksApiService.getTasks.and.returnValue(of(mockTasks));
      fixture.detectChanges();

      component.noteIdFilter.set('note-1');
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(2);
      expect(filtered.every(t => t.note_id === 'note-1')).toBe(true);
    });
  });
});
