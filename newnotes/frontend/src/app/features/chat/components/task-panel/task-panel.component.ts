import { Component, OnInit, inject, DestroyRef, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TaskDetectionService } from '../../services/task-detection.service';
import { DetectedTask } from '../../models/detected-task.model';
import { DuplicateNotificationComponent } from '../duplicate-notification/duplicate-notification.component';
import { DuplicateCheckResult } from '../../models/task-deduplication.model';

@Component({
  selector: 'app-task-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    DuplicateNotificationComponent
  ],
  templateUrl: './task-panel.component.html',
  styleUrl: './task-panel.component.scss'
})
export class TaskPanelComponent implements OnInit {
  private readonly taskService = inject(TaskDetectionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // Inputs from parent
  @Input() duplicateChecks: Map<string, DuplicateCheckResult> = new Map();
  @Input() isCheckingDuplicates: boolean = false;
  @Input() onViewSimilar?: (taskId: string) => void;
  @Input() onDismissDuplicate?: (taskId: string) => void;

  // Expose service signals
  readonly tasks = this.taskService.activeTasks;
  readonly isLoading = this.taskService.isLoading;
  readonly error = this.taskService.error;

  // Local state
  readonly isPanelCollapsed = signal<boolean>(false);
  readonly convertingTasks = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.loadActiveTasks();
  }

  private loadActiveTasks(): void {
    this.taskService.getActiveTasks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Tasks are automatically updated via signal
        },
        error: (error) => {
          console.error('Failed to load active tasks:', error);
          this.showError('Failed to load tasks');
        }
      });
  }

  onDeleteTask(task: DetectedTask, event: Event): void {
    event.stopPropagation();

    // Simple confirmation via snackbar action
    const snackBarRef = this.snackBar.open(
      `Delete task "${task.title}"?`,
      'Delete',
      {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      }
    );

    snackBarRef.onAction()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.deleteTask(task.id);
      });
  }

  private deleteTask(taskId: string): void {
    this.taskService.deleteTask(taskId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showSuccess('Task deleted');
        },
        error: (error) => {
          console.error('Failed to delete task:', error);
          this.showError('Failed to delete task');
        }
      });
  }

  onConvertTask(task: DetectedTask, event: Event): void {
    event.stopPropagation();

    // Add to converting set
    this.convertingTasks.update(tasks => new Set(tasks).add(task.id));

    // Call conversion API
    this.taskService.convertToMainTask(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // Remove from converting set
          this.convertingTasks.update(tasks => {
            const newSet = new Set(tasks);
            newSet.delete(task.id);
            return newSet;
          });

          // Show success message
          this.showSuccess('Task added to your task list');
        },
        error: (error) => {
          console.error('Failed to convert task:', error);

          // Remove from converting set
          this.convertingTasks.update(tasks => {
            const newSet = new Set(tasks);
            newSet.delete(task.id);
            return newSet;
          });

          // Show error with retry option
          const snackBarRef = this.snackBar.open(
            'Failed to add task. Try again?',
            'Retry',
            {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['error-snackbar']
            }
          );

          snackBarRef.onAction()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              this.onConvertTask(task, event);
            });
        }
      });
  }

  isConverting(taskId: string): boolean {
    return this.convertingTasks().has(taskId);
  }

  togglePanel(): void {
    this.isPanelCollapsed.update(collapsed => !collapsed);
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high':
        return 'warn';
      case 'medium':
        return 'accent';
      case 'low':
        return 'primary';
      default:
        return '';
    }
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority}`;
  }

  getConfidencePercentage(confidence: number): number {
    return Math.round(confidence * 100);
  }

  formatDate(date: Date | null): string {
    if (!date) {
      return 'No due date';
    }

    const dateObj = new Date(date);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if date is today
    if (dateObj.toDateString() === now.toDateString()) {
      return 'Today';
    }

    // Check if date is tomorrow
    if (dateObj.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    // Format as short date
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['error-snackbar']
    });
  }

  /**
   * Get duplicate check result for a task
   */
  getDuplicateCheck(taskId: string): DuplicateCheckResult | null {
    return this.duplicateChecks.get(taskId) || null;
  }

  /**
   * Handle view similar button click
   */
  handleViewSimilar(taskId: string): void {
    if (this.onViewSimilar) {
      this.onViewSimilar(taskId);
    }
  }

  /**
   * Handle dismiss button click
   */
  handleDismiss(taskId: string): void {
    if (this.onDismissDuplicate) {
      this.onDismissDuplicate(taskId);
    }
  }
}
