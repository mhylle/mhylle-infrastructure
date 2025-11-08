import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// Define extended interface for display purposes
export interface RecommendationDisplay {
  topic: string;
  totalScore: number; // 0-100 for display
  reasoning: string;
  signals: {
    coOccurrence: number;
    semanticSimilarity: number;
    hierarchy: number;
    temporal: number;
  };
  interestId: string;
}

@Component({
  selector: 'app-recommendation-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './recommendation-card.component.html',
  styleUrls: ['./recommendation-card.component.scss']
})
export class RecommendationCardComponent {
  @Input() recommendation!: RecommendationDisplay;
  @Input() showSignals = true;
  @Output() subscribe = new EventEmitter<string>();

  /**
   * Get the color class for the overall score based on percentage
   */
  getScoreColorClass(): string {
    const score = this.recommendation.totalScore;
    if (score >= 75) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }

  /**
   * Emit subscribe event with interest ID
   */
  onSubscribe(): void {
    this.subscribe.emit(this.recommendation.interestId);
  }

  /**
   * Get signal breakdown data for display
   */
  getSignalBreakdown() {
    return [
      {
        name: 'Co-occurrence',
        value: this.recommendation.signals.coOccurrence,
        color: 'signal-blue',
        icon: 'link'
      },
      {
        name: 'Semantic Similarity',
        value: this.recommendation.signals.semanticSimilarity,
        color: 'signal-green',
        icon: 'psychology'
      },
      {
        name: 'Hierarchy',
        value: this.recommendation.signals.hierarchy,
        color: 'signal-purple',
        icon: 'account_tree'
      },
      {
        name: 'Temporal',
        value: this.recommendation.signals.temporal,
        color: 'signal-orange',
        icon: 'schedule'
      }
    ];
  }
}
