import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { InterestsApiService } from '../../services/interests-api.service';
import { Interest } from '../../models/interest.model';
import { Subscription } from '../../models/subscription.model';
import { RecommendationCardComponent } from '../recommendation-card/recommendation-card.component';
import { HierarchyTreeComponent } from '../hierarchy-tree/hierarchy-tree.component';
import { RecommendationsResponse, InterestRecommendation } from '../../models/recommendation.model';
import { HierarchyResponse } from '../../models/hierarchy.model';

@Component({
  selector: 'app-interests-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatTabsModule,
    MatExpansionModule,
    RecommendationCardComponent,
    HierarchyTreeComponent
  ],
  templateUrl: './interests-manager.component.html',
  styleUrls: ['./interests-manager.component.scss']
})
export class InterestsManagerComponent implements OnInit {
  autoDetected = signal<Interest[]>([]);
  subscriptions = signal<Subscription[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Hierarchy state
  hierarchy = signal<HierarchyResponse | undefined>(undefined);
  hierarchyLoading = signal(false);
  hierarchyError = signal<string | null>(null);
  selectedInterestId = signal<string | undefined>(undefined);

  // Recommendations state - track per interest
  recommendationsMap = signal<Map<string, RecommendationsResponse>>(new Map());
  recommendationsLoading = signal<Set<string>>(new Set());
  recommendationsError = signal<Map<string, string>>(new Map());
  expandedInterestIds = signal<Set<string>>(new Set());

  newTopic = '';
  newFrequency: 'daily' | 'weekly' | 'real-time' = 'daily';

  frequencies = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'real-time', label: 'Real-time' }
  ];

  constructor(
    private interestsService: InterestsApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadHierarchy();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    Promise.all([
      this.interestsService.getInterests().toPromise(),
      this.interestsService.getSubscriptions().toPromise()
    ]).then(([interests, subscriptions]) => {
      this.autoDetected.set(interests || []);
      this.subscriptions.set(subscriptions || []);
      this.loading.set(false);
    }).catch(error => {
      console.error('Failed to load data:', error);
      this.error.set('Failed to load interests and subscriptions');
      this.loading.set(false);
      this.showMessage('Failed to load data', 'error');
    });
  }

  confirm(interest: Interest): void {
    this.interestsService.confirmInterest(interest.id, interest.topic)
      .subscribe({
        next: () => {
          this.autoDetected.update(list =>
            list.filter(i => i.id !== interest.id)
          );
          this.loadData();
          this.showMessage(`Subscribed to ${interest.topic}`, 'success');
        },
        error: (err) => {
          console.error('Failed to confirm interest:', err);
          this.showMessage('Failed to confirm interest', 'error');
        }
      });
  }

  ignore(interest: Interest): void {
    this.interestsService.deleteInterest(interest.id)
      .subscribe({
        next: () => {
          this.autoDetected.update(list =>
            list.filter(i => i.id !== interest.id)
          );
          this.showMessage(`Ignored ${interest.topic}`, 'success');
        },
        error: (err) => {
          console.error('Failed to ignore interest:', err);
          this.showMessage('Failed to ignore interest', 'error');
        }
      });
  }

  addTopic(): void {
    if (!this.newTopic.trim()) {
      this.showMessage('Please enter a topic', 'warning');
      return;
    }

    this.interestsService.createSubscription(this.newTopic.trim(), this.newFrequency)
      .subscribe({
        next: () => {
          this.newTopic = '';
          this.loadData();
          this.showMessage('Topic added successfully', 'success');
        },
        error: (err) => {
          console.error('Failed to add topic:', err);
          this.showMessage(err.error?.message || 'Failed to add topic', 'error');
        }
      });
  }

  updateFrequency(sub: Subscription, frequency: string): void {
    this.interestsService.updateSubscription(sub.id, {
      notificationFrequency: frequency as any
    }).subscribe({
      next: () => {
        this.loadData();
        this.showMessage('Frequency updated', 'success');
      },
      error: (err) => {
        console.error('Failed to update frequency:', err);
        this.showMessage('Failed to update frequency', 'error');
      }
    });
  }

  toggleEnabled(sub: Subscription): void {
    this.interestsService.updateSubscription(sub.id, {
      enabled: !sub.enabled
    }).subscribe({
      next: () => {
        this.loadData();
        this.showMessage(`Subscription ${sub.enabled ? 'disabled' : 'enabled'}`, 'success');
      },
      error: (err) => {
        console.error('Failed to toggle subscription:', err);
        this.showMessage('Failed to toggle subscription', 'error');
      }
    });
  }

  remove(sub: Subscription): void {
    if (!confirm(`Remove subscription to "${sub.topic}"?`)) {
      return;
    }

    this.interestsService.deleteSubscription(sub.id)
      .subscribe({
        next: () => {
          this.subscriptions.update(list =>
            list.filter(s => s.id !== sub.id)
          );
          this.showMessage('Subscription removed', 'success');
        },
        error: (err) => {
          console.error('Failed to remove subscription:', err);
          this.showMessage('Failed to remove subscription', 'error');
        }
      });
  }

  getConfidenceClass(confidence: number): string {
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.75) return 'confidence-medium';
    return 'confidence-low';
  }

  private showMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: [`snackbar-${type}`]
    });
  }

  // Hierarchy methods
  loadHierarchy(): void {
    this.hierarchyLoading.set(true);
    this.hierarchyError.set(null);

    this.interestsService.getHierarchy().subscribe({
      next: (response) => {
        this.hierarchy.set(response);
        this.hierarchyLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load hierarchy:', err);
        this.hierarchyError.set('Failed to load interest hierarchy');
        this.hierarchyLoading.set(false);
      }
    });
  }

  onInterestSelected(interestId: string): void {
    this.selectedInterestId.set(interestId);
    // Optionally load recommendations for selected interest
    if (!this.recommendationsMap().has(interestId)) {
      this.loadRecommendations(interestId);
    }
  }

  // Recommendations methods
  toggleRecommendations(interestId: string): void {
    const expanded = this.expandedInterestIds();
    const newExpanded = new Set(expanded);

    if (newExpanded.has(interestId)) {
      newExpanded.delete(interestId);
    } else {
      newExpanded.add(interestId);
      // Load recommendations if not already loaded
      if (!this.recommendationsMap().has(interestId)) {
        this.loadRecommendations(interestId);
      }
    }

    this.expandedInterestIds.set(newExpanded);
  }

  isRecommendationsExpanded(interestId: string): boolean {
    return this.expandedInterestIds().has(interestId);
  }

  loadRecommendations(interestId: string): void {
    const loading = new Set(this.recommendationsLoading());
    loading.add(interestId);
    this.recommendationsLoading.set(loading);

    // Clear any previous error for this interest
    const errors = new Map(this.recommendationsError());
    errors.delete(interestId);
    this.recommendationsError.set(errors);

    this.interestsService.getRecommendations(interestId, 10, 0.3).subscribe({
      next: (response) => {
        const recommendations = new Map(this.recommendationsMap());
        recommendations.set(interestId, response);
        this.recommendationsMap.set(recommendations);

        const loading = new Set(this.recommendationsLoading());
        loading.delete(interestId);
        this.recommendationsLoading.set(loading);
      },
      error: (err) => {
        console.error('Failed to load recommendations:', err);

        const errors = new Map(this.recommendationsError());
        errors.set(interestId, 'Failed to load recommendations');
        this.recommendationsError.set(errors);

        const loading = new Set(this.recommendationsLoading());
        loading.delete(interestId);
        this.recommendationsLoading.set(loading);

        this.showMessage('Failed to load recommendations', 'error');
      }
    });
  }

  getRecommendations(interestId: string): InterestRecommendation[] {
    const response = this.recommendationsMap().get(interestId);
    return response?.recommendations || [];
  }

  isRecommendationsLoading(interestId: string): boolean {
    return this.recommendationsLoading().has(interestId);
  }

  getRecommendationsError(interestId: string): string | undefined {
    return this.recommendationsError().get(interestId);
  }

  onSubscribeToRecommendation(topic: string): void {
    this.interestsService.createSubscription(topic, this.newFrequency).subscribe({
      next: () => {
        this.showMessage(`Subscribed to ${topic}`, 'success');
        this.loadData(); // Refresh subscriptions list
      },
      error: (err) => {
        console.error('Failed to subscribe:', err);
        const message = err.error?.message || 'Failed to subscribe to interest';
        this.showMessage(message, 'error');
      }
    });
  }

  // Helper method to convert recommendation score to display format
  getRecommendationWithTotalScore(recommendation: InterestRecommendation): any {
    return {
      ...recommendation,
      totalScore: Math.round(recommendation.score * 100)
    };
  }
}
