import { Component, OnInit, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { SearchService, SearchMode, SearchResult } from './search.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatIconModule,
    MatButtonToggleModule,
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit {
  private searchService = inject(SearchService);
  private router = inject(Router);

  // Search state
  query = signal('');
  mode = signal<SearchMode>(SearchMode.HYBRID);
  results = signal<SearchResult[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  processingTime = signal<number | null>(null);

  // Search subject for debouncing
  private searchSubject = new Subject<string>();

  // Computed values
  hasResults = computed(() => this.results().length > 0);
  isEmpty = computed(() => !this.isLoading() && !this.hasResults() && this.query().length > 0);

  // Search modes enum for template
  SearchMode = SearchMode;

  ngOnInit() {
    // Setup debounced search
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query || query.trim().length === 0) {
            this.results.set([]);
            this.isLoading.set(false);
            return [];
          }

          this.isLoading.set(true);
          this.error.set(null);

          return this.searchService.search({
            query: query.trim(),
            mode: this.mode(),
            limit: 20,
            minScore: 0.0,
          });
        }),
      )
      .subscribe({
        next: (response) => {
          this.results.set(response.results);
          this.processingTime.set(response.processingTimeMs);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Search error:', err);
          this.error.set('Failed to perform search. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  onQueryChange(query: string) {
    this.query.set(query);
    this.searchSubject.next(query);
  }

  onModeChange(mode: SearchMode) {
    this.mode.set(mode);
    if (this.query()) {
      this.searchSubject.next(this.query());
    }
  }

  onResultClick(result: SearchResult) {
    this.router.navigate(['/notes', result.id]);
  }

  getScorePercentage(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  getScoreColor(score: number): string {
    if (score >= 0.8) return 'accent';
    if (score >= 0.5) return 'primary';
    return 'warn';
  }

  getModeLabel(mode: SearchMode): string {
    switch (mode) {
      case SearchMode.SEMANTIC:
        return 'Semantic';
      case SearchMode.KEYWORD:
        return 'Keyword';
      case SearchMode.HYBRID:
        return 'Hybrid';
      default:
        return 'Unknown';
    }
  }

  clearSearch() {
    this.query.set('');
    this.results.set([]);
    this.processingTime.set(null);
    this.error.set(null);
  }
}
