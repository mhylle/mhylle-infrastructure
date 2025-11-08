import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HierarchyTreeComponent } from './hierarchy-tree.component';
import { HierarchyResponse, HierarchyNode } from '../../models/hierarchy.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('HierarchyTreeComponent', () => {
  let component: HierarchyTreeComponent;
  let fixture: ComponentFixture<HierarchyTreeComponent>;

  const mockHierarchyData: HierarchyResponse = {
    roots: [
      {
        id: '1',
        topic: 'Technology',
        confidence: 0.85,
        evidenceCount: 10,
        depth: 0,
        children: [
          {
            id: '2',
            topic: 'Web Development',
            confidence: 0.75,
            evidenceCount: 8,
            depth: 1,
            children: [
              {
                id: '3',
                topic: 'Angular',
                confidence: 0.90,
                evidenceCount: 15,
                depth: 2,
                children: []
              }
            ]
          }
        ]
      },
      {
        id: '4',
        topic: 'Science',
        confidence: 0.70,
        evidenceCount: 5,
        depth: 0,
        children: []
      }
    ],
    totalInterests: 4,
    totalLevels: 3
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HierarchyTreeComponent, NoopAnimationsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(HierarchyTreeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display empty state when no hierarchy data', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    const emptyState = compiled.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No hierarchy data available');
  });

  it('should render hierarchy tree when data is provided', () => {
    component.hierarchy = mockHierarchyData;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const emptyState = compiled.querySelector('.empty-state');
    const treeWrapper = compiled.querySelector('.tree-wrapper');

    expect(emptyState).toBeFalsy();
    expect(treeWrapper).toBeTruthy();
  });

  it('should determine if node has children', () => {
    const nodeWithChildren: HierarchyNode = {
      id: '1',
      topic: 'Parent',
      confidence: 0.8,
      evidenceCount: 5,
      depth: 0,
      children: [
        { id: '2', topic: 'Child', confidence: 0.7, evidenceCount: 3, depth: 1, children: [] }
      ]
    };

    const nodeWithoutChildren: HierarchyNode = {
      id: '3',
      topic: 'Leaf',
      confidence: 0.9,
      evidenceCount: 7,
      depth: 0,
      children: []
    };

    expect(component.hasChild(0, nodeWithChildren)).toBe(true);
    expect(component.hasChild(0, nodeWithoutChildren)).toBe(false);
  });

  it('should emit interestSelected event when node is clicked', () => {
    const testNode: HierarchyNode = {
      id: 'test-id',
      topic: 'Test Topic',
      confidence: 0.8,
      evidenceCount: 5,
      depth: 0,
      children: []
    };

    spyOn(component.interestSelected, 'emit');
    component.onNodeClick(testNode);

    expect(component.interestSelected.emit).toHaveBeenCalledWith('test-id');
  });

  it('should correctly identify selected node', () => {
    component.selectedInterestId = 'selected-id';

    const selectedNode: HierarchyNode = {
      id: 'selected-id',
      topic: 'Selected',
      confidence: 0.8,
      evidenceCount: 5,
      depth: 0,
      children: []
    };

    const unselectedNode: HierarchyNode = {
      id: 'other-id',
      topic: 'Other',
      confidence: 0.7,
      evidenceCount: 3,
      depth: 0,
      children: []
    };

    expect(component.isSelected(selectedNode)).toBe(true);
    expect(component.isSelected(unselectedNode)).toBe(false);
  });

  describe('getConfidenceClass', () => {
    it('should return high class for confidence >= 70%', () => {
      expect(component.getConfidenceClass(0.85)).toBe('confidence-high');
      expect(component.getConfidenceClass(0.70)).toBe('confidence-high');
    });

    it('should return medium class for confidence 50-69%', () => {
      expect(component.getConfidenceClass(0.60)).toBe('confidence-medium');
      expect(component.getConfidenceClass(0.50)).toBe('confidence-medium');
    });

    it('should return low class for confidence < 50%', () => {
      expect(component.getConfidenceClass(0.40)).toBe('confidence-low');
      expect(component.getConfidenceClass(0.20)).toBe('confidence-low');
    });
  });

  describe('formatConfidence', () => {
    it('should format confidence as percentage', () => {
      expect(component.formatConfidence(0.856)).toBe('86%');
      expect(component.formatConfidence(0.724)).toBe('72%');
      expect(component.formatConfidence(0.50)).toBe('50%');
    });
  });

  it('should update data source when hierarchy input changes', () => {
    component.hierarchy = mockHierarchyData;
    component.ngOnChanges({
      hierarchy: {
        currentValue: mockHierarchyData,
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true
      }
    });

    expect(component.dataSource.data).toEqual(mockHierarchyData.roots);
  });

  it('should return correct hasData value', () => {
    expect(component.hasData()).toBe(false);

    component.hierarchy = mockHierarchyData;
    expect(component.hasData()).toBe(true);

    component.hierarchy = { roots: [], totalInterests: 0, totalLevels: 0 };
    expect(component.hasData()).toBe(false);
  });
});
