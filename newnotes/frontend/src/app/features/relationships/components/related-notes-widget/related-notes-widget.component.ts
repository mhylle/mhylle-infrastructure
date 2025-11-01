import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { RelationshipsService } from '../../services/relationships.service';
import { RelatedNote, RelationshipGroup, RelationshipType } from '../../models/relationship.model';

@Component({
  selector: 'app-related-notes-widget',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './related-notes-widget.component.html',
  styleUrls: ['./related-notes-widget.component.scss']
})
export class RelatedNotesWidgetComponent implements OnInit {
  @Input({ required: true }) noteId!: string;

  // Injected services
  private relationshipsService = inject(RelationshipsService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  // Core signals
  relations = signal<RelatedNote[]>([]);
  loading = signal<boolean>(false);
  detecting = signal<boolean>(false);

  // Computed signals
  groupedRelations = computed(() => {
    const groups = new Map<RelationshipType, RelatedNote[]>();

    for (const rel of this.relations()) {
      const type = rel.relationship.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(rel);
    }

    return Array.from(groups.entries())
      .map(([type, relations]) => ({
        type,
        relations: relations.sort((a, b) => b.relationship.confidence - a.relationship.confidence)
      }))
      .sort((a, b) => b.relations.length - a.relations.length);
  });

  hasRelations = computed(() => this.relations().length > 0);

  ngOnInit(): void {
    this.loadRelationships();
  }

  /**
   * Load relationships for the current note
   */
  async loadRelationships(): Promise<void> {
    if (!this.noteId) {
      console.warn('No noteId provided to related-notes-widget');
      return;
    }

    this.loading.set(true);
    try {
      const related = await firstValueFrom(this.relationshipsService.getRelated(this.noteId));
      this.relations.set(related);
    } catch (error) {
      console.error('Error loading relationships:', error);
      this.snackBar.open('Failed to load related notes', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Refresh relationships
   */
  async refresh(): Promise<void> {
    // Clear cache first
    this.relationshipsService.clearCache(this.noteId);
    await this.loadRelationships();
    this.snackBar.open('Related notes refreshed', 'Close', {
      duration: 2000
    });
  }

  /**
   * Trigger manual similarity detection
   */
  async detectRelationships(): Promise<void> {
    this.detecting.set(true);
    try {
      const result = await this.relationshipsService.triggerDetection();
      this.snackBar.open(
        `Detection complete: ${result.created} new relationships found`,
        'Close',
        { duration: 4000 }
      );
      // Reload relationships after detection
      await this.loadRelationships();
    } catch (error) {
      console.error('Error detecting relationships:', error);
      this.snackBar.open('Failed to detect relationships', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.detecting.set(false);
    }
  }

  /**
   * Navigate to a related note
   */
  navigateToNote(noteId: string): void {
    this.router.navigate(['/notes', noteId]);
  }

  /**
   * Truncate note content for display
   */
  truncateContent(content: string, maxLength: number = 50): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * Format confidence as percentage
   */
  formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  /**
   * Get icon for relationship type
   */
  getRelationshipIcon(type: RelationshipType): string {
    const icons: Record<RelationshipType, string> = {
      semantic: 'psychology',
      referential: 'link',
      causal: 'trending_up',
      temporal: 'schedule'
    };
    return icons[type] || 'link';
  }

  /**
   * Get label for relationship type
   */
  getRelationshipLabel(type: RelationshipType): string {
    const labels: Record<RelationshipType, string> = {
      semantic: 'Semantically Similar',
      referential: 'Referenced',
      causal: 'Causally Related',
      temporal: 'Temporally Related'
    };
    return labels[type] || type;
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByNoteId(_index: number, note: RelatedNote): string {
    return note.id;
  }

  /**
   * Track by function for groups
   */
  trackByType(_index: number, group: RelationshipGroup): RelationshipType {
    return group.type;
  }
}
