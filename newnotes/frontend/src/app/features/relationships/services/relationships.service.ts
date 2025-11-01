import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  NoteRelationship,
  RelatedNote,
  RelationshipStats
} from '../models/relationship.model';

@Injectable({
  providedIn: 'root'
})
export class RelationshipsService {
  private readonly apiUrl = `${environment.apiUrl}/notes`;

  // Signal for related notes cache
  private relatedNotesCache = signal<Map<string, RelatedNote[]>>(new Map());

  constructor(private http: HttpClient) {}

  /**
   * Get all relationships for a specific note
   */
  getRelationships(noteId: string): Observable<NoteRelationship[]> {
    return this.http.get<NoteRelationship[]>(`${this.apiUrl}/${noteId}/relationships`);
  }

  /**
   * Get related notes with full details for a specific note
   */
  getRelated(noteId: string): Observable<RelatedNote[]> {
    return this.http.get<RelatedNote[]>(`${this.apiUrl}/${noteId}/related`).pipe(
      tap(notes => {
        // Update cache
        const cache = this.relatedNotesCache();
        cache.set(noteId, notes);
        this.relatedNotesCache.set(new Map(cache));
      })
    );
  }

  /**
   * Get related notes synchronously from cache
   */
  getRelatedFromCache(noteId: string): RelatedNote[] {
    return this.relatedNotesCache().get(noteId) || [];
  }

  /**
   * Trigger manual similarity detection for all notes
   */
  async triggerDetection(): Promise<{ message: string; processed: number; created: number }> {
    return firstValueFrom(
      this.http.post<{ message: string; processed: number; created: number }>(
        `${this.apiUrl}/relationships/detect`,
        {}
      )
    );
  }

  /**
   * Trigger wiki link processing for all notes
   */
  async triggerWikiLinkProcessing(): Promise<{ message: string; processed: number; created: number }> {
    return firstValueFrom(
      this.http.post<{ message: string; processed: number; created: number }>(
        `${this.apiUrl}/relationships/wiki-links`,
        {}
      )
    );
  }

  /**
   * Get relationship statistics
   */
  getStats(): Observable<RelationshipStats> {
    return this.http.get<RelationshipStats>(`${this.apiUrl}/relationships/stats`);
  }

  /**
   * Delete a specific relationship
   */
  deleteRelationship(relationshipId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/relationships/${relationshipId}`);
  }

  /**
   * Clear cache for a specific note
   */
  clearCache(noteId: string): void {
    const cache = this.relatedNotesCache();
    cache.delete(noteId);
    this.relatedNotesCache.set(new Map(cache));
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.relatedNotesCache.set(new Map());
  }
}
