import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RelatedNotesWidgetComponent } from './related-notes-widget.component';
import { RelationshipsService } from '../../services/relationships.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('RelatedNotesWidgetComponent', () => {
  let component: RelatedNotesWidgetComponent;
  let fixture: ComponentFixture<RelatedNotesWidgetComponent>;
  let mockRelationshipsService: jasmine.SpyObj<RelationshipsService>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockRelationshipsService = jasmine.createSpyObj('RelationshipsService', [
      'getRelated',
      'triggerDetection',
      'clearCache'
    ]);
    mockSnackBar = jasmine.createSpyObj('MatSnackBar', ['open']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RelatedNotesWidgetComponent, NoopAnimationsModule],
      providers: [
        { provide: RelationshipsService, useValue: mockRelationshipsService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RelatedNotesWidgetComponent);
    component = fixture.componentInstance;
    component.noteId = 'test-note-id';
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load relationships on init', async () => {
    const mockRelations = [
      {
        id: 'note-1',
        content: 'Test note 1',
        raw_content: 'Test note 1',
        created_at: new Date(),
        updated_at: new Date(),
        source: 'text',
        relationship: {
          id: 'rel-1',
          type: 'semantic' as const,
          confidence: 0.85,
          metadata: {}
        }
      }
    ];

    mockRelationshipsService.getRelated.and.returnValue(of(mockRelations));

    await component.ngOnInit();

    expect(mockRelationshipsService.getRelated).toHaveBeenCalledWith('test-note-id');
    expect(component.relations()).toEqual(mockRelations);
  });

  it('should handle error when loading relationships', async () => {
    mockRelationshipsService.getRelated.and.returnValue(
      throwError(() => new Error('Test error'))
    );

    await component.loadRelationships();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Failed to load related notes',
      'Close',
      jasmine.any(Object)
    );
  });

  it('should refresh relationships', async () => {
    const mockRelations: any[] = [];
    mockRelationshipsService.getRelated.and.returnValue(of(mockRelations));

    await component.refresh();

    expect(mockRelationshipsService.clearCache).toHaveBeenCalledWith('test-note-id');
    expect(mockRelationshipsService.getRelated).toHaveBeenCalled();
  });

  it('should navigate to related note', () => {
    component.navigateToNote('note-123');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/notes', 'note-123']);
  });

  it('should truncate long content', () => {
    const longContent = 'a'.repeat(100);
    const truncated = component.truncateContent(longContent, 50);
    expect(truncated.length).toBe(53); // 50 + '...'
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('should format confidence as percentage', () => {
    expect(component.formatConfidence(0.85)).toBe('85%');
    expect(component.formatConfidence(1.0)).toBe('100%');
  });
});
