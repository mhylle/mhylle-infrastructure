import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { DetectedTask, TaskDetectionResponse } from '../models/detected-task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskDetectionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/chat`;

  // Signal for active tasks
  readonly activeTasks = signal<DetectedTask[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Detect tasks from a chat message and auto-create them
   */
  detectTasksFromMessage(messageId: string): Observable<TaskDetectionResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.post<TaskDetectionResponse>(
      `${this.baseUrl}/messages/${messageId}/detect-tasks`,
      {}
    ).pipe(
      tap(response => {
        // Update active tasks with newly detected tasks
        const currentTasks = this.activeTasks();
        const newTasks = response.tasks.filter(
          task => !currentTasks.some(t => t.id === task.id)
        );
        this.activeTasks.set([...currentTasks, ...newTasks]);
        this.isLoading.set(false);
      }),
      catchError(error => this.handleError(error, 'Failed to detect tasks'))
    );
  }

  /**
   * Get all active tasks for the current session
   */
  getActiveTasks(): Observable<DetectedTask[]> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.get<{ success: boolean; tasks: DetectedTask[]; count: number }>(
      `${this.baseUrl}/detected-tasks/active`
    ).pipe(
      map(response => response.tasks),
      tap(tasks => {
        this.activeTasks.set(tasks);
        this.isLoading.set(false);
      }),
      catchError(error => this.handleError(error, 'Failed to load tasks'))
    );
  }

  /**
   * Get tasks associated with a specific message
   */
  getTasksForMessage(messageId: string): Observable<DetectedTask[]> {
    return this.http.get<{ success: boolean; tasks: DetectedTask[]; count: number }>(
      `${this.baseUrl}/messages/${messageId}/detected-tasks`
    ).pipe(
      map(response => response.tasks),
      catchError(error => this.handleError(error, 'Failed to load message tasks'))
    );
  }

  /**
   * Delete a task (soft delete to 'deleted' status)
   */
  deleteTask(taskId: string): Observable<DetectedTask> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.delete<{ success: boolean; task: DetectedTask }>(
      `${this.baseUrl}/detected-tasks/${taskId}`
    ).pipe(
      map(response => response.task),
      tap(deletedTask => {
        // Remove from active tasks
        const currentTasks = this.activeTasks();
        this.activeTasks.set(currentTasks.filter(t => t.id !== taskId));
        this.isLoading.set(false);
      }),
      catchError(error => this.handleError(error, 'Failed to delete task'))
    );
  }

  /**
   * Convert detected task to main task
   */
  convertToMainTask(
    detectedTaskId: string,
    options?: { noteId?: string; parentTaskId?: string }
  ): Observable<{ success: boolean; task: any; detectedTaskId: string; message: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.post<{ success: boolean; task: any; detectedTaskId: string; message: string }>(
      `${this.baseUrl}/detected-tasks/${detectedTaskId}/create-task`,
      options || {}
    ).pipe(
      tap(response => {
        // Remove from active tasks after successful conversion
        const currentTasks = this.activeTasks();
        this.activeTasks.set(currentTasks.filter(t => t.id !== detectedTaskId));
        this.isLoading.set(false);
      }),
      catchError(error => this.handleError(error, 'Failed to convert task'))
    );
  }

  /**
   * Clear all tasks (for session cleanup)
   */
  clearTasks(): void {
    this.activeTasks.set([]);
    this.error.set(null);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse, userMessage: string): Observable<never> {
    console.error('TaskDetectionService error:', error);

    let errorMessage = userMessage;

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `${userMessage}: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = error.error?.message ||
                    error.message ||
                    `${userMessage} (${error.status})`;
    }

    this.error.set(errorMessage);
    this.isLoading.set(false);

    return throwError(() => new Error(errorMessage));
  }
}
