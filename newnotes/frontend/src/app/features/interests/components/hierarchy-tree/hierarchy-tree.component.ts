import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { HierarchyResponse, HierarchyNode } from '../../models/hierarchy.model';

/**
 * Hierarchy Tree Component
 *
 * Displays interest hierarchy as an expandable/collapsible tree structure.
 * Each node shows the interest topic, confidence score, and evidence count.
 *
 * Single Responsibility: Visualize hierarchical interest relationships in tree format
 */
@Component({
  selector: 'app-hierarchy-tree',
  standalone: true,
  imports: [
    CommonModule,
    MatTreeModule,
    MatIconModule,
    MatBadgeModule,
    MatButtonModule
  ],
  templateUrl: './hierarchy-tree.component.html',
  styleUrls: ['./hierarchy-tree.component.scss']
})
export class HierarchyTreeComponent implements OnChanges {
  /** The complete hierarchy data to display */
  @Input() hierarchy?: HierarchyResponse;

  /** Currently selected interest to highlight */
  @Input() selectedInterestId?: string;

  /** Emits interest ID when a node is clicked */
  @Output() interestSelected = new EventEmitter<string>();

  /** Tree control for managing expand/collapse state */
  treeControl = new NestedTreeControl<HierarchyNode>(node => node.children);

  /** Data source for the tree */
  dataSource = new MatTreeNestedDataSource<HierarchyNode>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hierarchy'] && this.hierarchy) {
      this.dataSource.data = this.hierarchy.roots;
    }
  }

  /**
   * Determines if a node has children
   */
  hasChild = (_: number, node: HierarchyNode): boolean => {
    return !!node.children && node.children.length > 0;
  };

  /**
   * Handles node selection
   */
  onNodeClick(node: HierarchyNode): void {
    this.interestSelected.emit(node.id);
  }

  /**
   * Checks if a node is currently selected
   */
  isSelected(node: HierarchyNode): boolean {
    return this.selectedInterestId === node.id;
  }

  /**
   * Gets CSS class for confidence badge based on score
   *
   * @param confidence - Confidence score (0-1)
   * @returns CSS class name
   */
  getConfidenceClass(confidence: number): string {
    const percentage = confidence * 100;

    if (percentage >= 70) {
      return 'confidence-high';
    } else if (percentage >= 50) {
      return 'confidence-medium';
    } else {
      return 'confidence-low';
    }
  }

  /**
   * Formats confidence score as percentage
   *
   * @param confidence - Confidence score (0-1)
   * @returns Formatted percentage string
   */
  formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  /**
   * Checks if hierarchy data is available and not empty
   */
  hasData(): boolean {
    return !!this.hierarchy && this.hierarchy.roots.length > 0;
  }
}
