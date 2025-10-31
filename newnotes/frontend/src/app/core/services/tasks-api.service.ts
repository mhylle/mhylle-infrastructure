import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  TaskFilterParams
} from '../models/task.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TasksApiService {
  private readonly apiUrl = `${environment.apiUrl}/tasks`;
  private readonly notesApiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTasks(filters?: TaskFilterParams): Observable<Task[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.noteId) {
        params = params.set('noteId', filters.noteId);
      }
      if (filters.status) {
        params = params.set('status', filters.status);
      }
      if (filters.priority) {
        params = params.set('priority', filters.priority);
      }
      if (filters.dueDateFrom) {
        params = params.set('dueDateFrom', filters.dueDateFrom);
      }
      if (filters.dueDateTo) {
        params = params.set('dueDateTo', filters.dueDateTo);
      }
      if (filters.sortBy) {
        params = params.set('sortBy', filters.sortBy);
      }
      if (filters.sortOrder) {
        params = params.set('sortOrder', filters.sortOrder);
      }
    }

    return this.http.get<Task[]>(this.apiUrl, { params });
  }

  getTaskById(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/${id}`);
  }

  getTasksByNoteId(noteId: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.notesApiUrl}/tasks/note/${noteId}`);
  }

  createTask(dto: CreateTaskDto): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, dto);
  }

  updateTask(id: string, dto: UpdateTaskDto): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/${id}`, dto);
  }

  updateTaskStatus(id: string, dto: UpdateTaskStatusDto): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/${id}/status`, dto);
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
