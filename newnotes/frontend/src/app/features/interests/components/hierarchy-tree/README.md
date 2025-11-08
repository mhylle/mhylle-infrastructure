# Hierarchy Tree Component

## Overview
Displays interest hierarchy as an expandable/collapsible tree structure. Each node shows the interest topic, confidence score, and evidence count.

## Single Responsibility
Visualize hierarchical interest relationships in tree format.

## Usage

```typescript
import { HierarchyTreeComponent } from '@features/interests/components';
import { HierarchyResponse } from '@features/interests/models';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [HierarchyTreeComponent],
  template: `
    <app-hierarchy-tree
      [hierarchy]="hierarchyData"
      [selectedInterestId]="selectedId"
      (interestSelected)="onInterestSelected($event)">
    </app-hierarchy-tree>
  `
})
export class ExampleComponent {
  hierarchyData?: HierarchyResponse;
  selectedId?: string;

  onInterestSelected(interestId: string): void {
    this.selectedId = interestId;
    // Handle interest selection
  }
}
```

## Inputs

| Input | Type | Description |
|-------|------|-------------|
| `hierarchy` | `HierarchyResponse \| undefined` | The complete hierarchy data to display |
| `selectedInterestId` | `string \| undefined` | Currently selected interest to highlight |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `interestSelected` | `EventEmitter<string>` | Emits interest ID when a node is clicked |

## Features

### Tree Structure
- Recursive display of hierarchy nodes
- Expandable/collapsible children with smooth animations
- Indent levels to show depth
- Icons for expand/collapse state

### Node Display
Each node shows:
- **Topic name**: The interest's topic
- **Confidence badge**: Color-coded percentage (green ≥70%, orange 50-69%, red <50%)
- **Evidence count badge**: Number of supporting evidence pieces
- **Selection highlight**: Visual indicator for selected interest

### Interactions
- Click node to select (emits `interestSelected` event)
- Click expand/collapse icon to toggle children
- Hover effects for better UX
- Keyboard navigation support

### Empty State
Displays a friendly message when no hierarchy data is available

## Styling

Uses Angular Material components:
- `MatTree` for tree structure
- `MatIcon` for icons
- `MatBadge` for evidence count
- Custom CSS classes for confidence badges

### Confidence Badge Colors
- **Green** (≥70%): High confidence
- **Orange** (50-69%): Medium confidence
- **Red** (<50%): Low confidence

## Accessibility

- Proper ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader friendly
- Reduced motion support

## Responsive Design

- Mobile-optimized layout
- Stacked badges on smaller screens
- Adjusted indentation for mobile
- Touch-friendly interactive elements

## Dark Mode

Full support for dark mode with proper contrast ratios and color adjustments.

## Example Hierarchy Data

```typescript
const exampleHierarchy: HierarchyResponse = {
  roots: [
    {
      id: '1',
      topic: 'Technology',
      confidence: 0.85,
      evidenceCount: 10,
      children: [
        {
          id: '2',
          topic: 'Web Development',
          confidence: 0.75,
          evidenceCount: 8,
          children: [
            {
              id: '3',
              topic: 'Angular',
              confidence: 0.90,
              evidenceCount: 15,
              children: []
            }
          ]
        }
      ]
    }
  ],
  totalInterests: 3,
  maxDepth: 3
};
```

## Technical Implementation

### Tree Control
Uses Angular Material's `NestedTreeControl` for managing expand/collapse state:
```typescript
treeControl = new NestedTreeControl<HierarchyNode>(node => node.children);
```

### Data Source
Uses `MatTreeNestedDataSource` for data binding:
```typescript
dataSource = new MatTreeNestedDataSource<HierarchyNode>();
```

### Change Detection
Implements `OnChanges` to update data source when hierarchy input changes.

## Dependencies

- `@angular/material/tree`
- `@angular/material/icon`
- `@angular/material/badge`
- `@angular/material/button`
- `@angular/cdk/tree`

## Notes

- Component is standalone and can be used independently
- No external service dependencies
- Fully unit tested with comprehensive test coverage
- Follows Angular Style Guide conventions
- Implements separation of concerns (presentation only)
