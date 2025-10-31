import { Component, OnInit, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TasksApiService } from '../../../core/services/tasks-api.service';
import { Task, TaskStatus, TaskPriority } from '../../../core/models/task.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss'
})
export class TaskListComponent implements OnInit {
  // Input for optional note filtering
  noteIdFilter = signal<string | null>(null);

  // State signals
  tasks = signal<Task[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  selectedStatus = signal<TaskStatus | 'all'>('all');
  selectedPriority = signal<TaskPriority | 'all'>('all');

  // Computed filtered tasks
  filteredTasks = computed(() => {
    let filtered = this.tasks();

    if (this.selectedStatus() !== 'all') {
      filtered = filtered.filter(t => t.status === this.selectedStatus());
    }

    if (this.selectedPriority() !== 'all') {
      filtered = filtered.filter(t => t.priority === this.selectedPriority());
    }

    if (this.noteIdFilter()) {
      filtered = filtered.filter(t => t.note_id === this.noteIdFilter());
    }

    return filtered;
  });

  // Expose enums for template
  readonly TaskStatus = TaskStatus;
  readonly TaskPriority = TaskPriority;

  // Status and priority options for filters
  readonly statusOptions: Array<TaskStatus | 'all'> = [
    'all',
    TaskStatus.PENDING,
    TaskStatus.IN_PROGRESS,
    TaskStatus.COMPLETED,
    TaskStatus.CANCELLED
  ];

  readonly priorityOptions: Array<TaskPriority | 'all'> = [
    'all',
    TaskPriority.LOW,
    TaskPriority.MEDIUM,
    TaskPriority.HIGH,
    TaskPriority.URGENT
  ];

  constructor(
    private tasksApiService: TasksApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check for noteId query parameter
    this.route.queryParams.subscribe(params => {
      if (params['noteId']) {
        this.noteIdFilter.set(params['noteId']);
      }
    });

    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    this.error.set(null);

    const filters = this.noteIdFilter() ? { noteId: this.noteIdFilter()! } : undefined;

    this.tasksApiService.getTasks(filters).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load tasks');
        this.loading.set(false);
        console.error('Error loading tasks:', err);
      }
    });
  }

  filterByStatus(status: TaskStatus | 'all'): void {
    this.selectedStatus.set(status);
  }

  filterByPriority(priority: TaskPriority | 'all'): void {
    this.selectedPriority.set(priority);
  }

  updateTaskStatus(task: Task, newStatus: TaskStatus): void {
    this.tasksApiService.updateTaskStatus(task.id, { status: newStatus }).subscribe({
      next: (updatedTask) => {
        // Update task in list for immediate UI feedback
        const index = this.tasks().findIndex(t => t.id === task.id);
        if (index !== -1) {
          this.tasks.update(tasks => {
            tasks[index] = updatedTask;
            return [...tasks];
          });
        }
        // Show success message
        this.snackBar.open(`Task status updated to ${this.formatStatusLabel(newStatus)}`, 'Close', {
          duration: 2000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      },
      error: (err) => {
        this.error.set('Failed to update task status');
        this.snackBar.open('Failed to update task status', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
        console.error('Error updating task status:', err);
      }
    });
  }

  deleteTask(task: Task): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Task',
        message: `Are you sure you want to delete "${task.title}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.tasksApiService.deleteTask(task.id).subscribe({
          next: () => {
            this.snackBar.open('Task deleted successfully', 'Close', {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom'
            });
            this.refreshTasks();
          },
          error: (err) => {
            this.error.set('Failed to delete task');
            this.snackBar.open('Failed to delete task', 'Close', {
              duration: 3000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom'
            });
            console.error('Error deleting task:', err);
          }
        });
      }
    });
  }

  refreshTasks(): void {
    this.loadTasks();
  }

  getStatusColor(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.PENDING:
        return 'status-pending';
      case TaskStatus.IN_PROGRESS:
        return 'status-in-progress';
      case TaskStatus.COMPLETED:
        return 'status-completed';
      case TaskStatus.CANCELLED:
        return 'status-cancelled';
      default:
        return '';
    }
  }

  getPriorityColor(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.LOW:
        return 'priority-low';
      case TaskPriority.MEDIUM:
        return 'priority-medium';
      case TaskPriority.HIGH:
        return 'priority-high';
      case TaskPriority.URGENT:
        return 'priority-urgent';
      default:
        return '';
    }
  }

  formatStatusLabel(status: TaskStatus | 'all'): string {
    if (status === 'all') return 'All';
    return status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  formatPriorityLabel(priority: TaskPriority | 'all'): string {
    if (priority === 'all') return 'All';
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }
}
