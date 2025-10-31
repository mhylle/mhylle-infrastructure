import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';

import { NotesApiService } from '../../../core/services/notes-api.service';
import { TasksApiService } from '../../../core/services/tasks-api.service';
import { Note } from '../../../core/models/note.model';
import { Task, TaskStatus, TaskPriority } from '../../../core/models/task.model';

@Component({
  selector: 'app-note-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatDividerModule,
    MatToolbarModule,
    MatCheckboxModule,
    MatChipsModule
  ],
  templateUrl: './note-detail.component.html',
  styleUrls: ['./note-detail.component.scss']
})
export class NoteDetailComponent implements OnInit {
  // Injected services
  private route = inject(ActivatedRoute);
  private notesApiService = inject(NotesApiService);
  private tasksApiService = inject(TasksApiService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // Core signals
  noteId = signal<string>('');
  note = signal<Note | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Computed signals for formatted metadata
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
    const createdTime = note.created_at instanceof Date
      ? note.created_at.getTime()
      : new Date(note.created_at).getTime();
    const updatedTime = note.updated_at instanceof Date
      ? note.updated_at.getTime()
      : new Date(note.updated_at).getTime();
    return updatedTime > createdTime;
  });

  taskCount = computed(() => {
    const note = this.note();
    if (!note?.metadata) return 0;
    // Support both taskCount and tasks_extracted for flexibility
    return note.metadata['taskCount'] || note.metadata['tasks_extracted'] || 0;
  });

  // Task-related signals
  tasks = signal<Task[]>([]);
  tasksLoading = signal<boolean>(false);
  tasksError = signal<string | null>(null);

  // Computed signals for tasks
  tasksByStatus = computed(() => {
    const tasks = this.tasks();
    return {
      pending: tasks.filter(t => t.status === TaskStatus.PENDING),
      in_progress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS),
      completed: tasks.filter(t => t.status === TaskStatus.COMPLETED),
      cancelled: tasks.filter(t => t.status === TaskStatus.CANCELLED)
    };
  });

  totalTasks = computed(() => this.tasks().length);
  completedTasks = computed(() => this.tasksByStatus().completed.length);

  ngOnInit(): void {
    // Extract note ID from route params and load note
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.noteId.set(id);
        this.loadNote();
      }
    });
  }

  /**
   * Load note from API by ID
   */
  loadNote(): void {
    this.loading.set(true);
    this.error.set(null);

    this.notesApiService.getNoteById(this.noteId()).subscribe({
      next: (note) => {
        this.note.set(note);
        this.loading.set(false);
        // Load tasks after note loads successfully
        this.loadTasks(this.noteId());
      },
      error: (err) => {
        this.loading.set(false);

        // Handle different error types
        if (err.status === 404) {
          this.error.set('Note not found');
        } else if (err.status === 0) {
          this.error.set('Failed to load note. Please check your network connection.');
        } else {
          this.error.set('Failed to load note. Please try again later.');
        }
      }
    });
  }

  /**
   * Load tasks for the current note
   */
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

  /**
   * Toggle task status between completed and pending
   */
  toggleTaskStatus(task: Task): void {
    const newStatus = task.status === TaskStatus.COMPLETED
      ? TaskStatus.PENDING
      : TaskStatus.COMPLETED;

    this.tasksApiService.updateTaskStatus(task.id, { status: newStatus }).subscribe({
      next: () => {
        // Reload tasks to get updated data
        this.loadTasks(this.noteId());
      },
      error: (err) => {
        this.tasksError.set('Failed to update task status');
      }
    });
  }

  /**
   * Navigate to edit view
   */
  onEdit(): void {
    this.router.navigate(['/notes', 'edit', this.noteId()]);
  }

  /**
   * Open delete confirmation dialog
   */
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

  /**
   * Delete note via API
   */
  private deleteNote(): void {
    this.loading.set(true);

    this.notesApiService.deleteNote(this.noteId()).subscribe({
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

  /**
   * Navigate back to notes list
   */
  onBack(): void {
    this.router.navigate(['/notes']);
  }

  /**
   * Format date to "MMM DD, YYYY at HH:MM AM/PM"
   */
  private formatDate(dateInput: Date | string): string {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

    // Format date part: "Oct 28, 2025"
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };
    const datePart = date.toLocaleDateString('en-US', dateOptions);

    // Format time part: "10:30 AM"
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    const timePart = date.toLocaleTimeString('en-US', timeOptions);

    return `${datePart} at ${timePart}`;
  }
}

/**
 * Dialog data interface for confirmation dialog
 */
export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

/**
 * Simple confirmation dialog component for delete action
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">{{ data.cancelText }}</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">{{ data.confirmText }}</button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  // Inject dialog data using MAT_DIALOG_DATA token
  data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
