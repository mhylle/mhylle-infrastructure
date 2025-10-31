import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { NoteEditorComponent } from './note-editor.component';
import { NotesApiService } from '../../../core/services/notes-api.service';
import { of } from 'rxjs';

describe('NoteEditorComponent', () => {
  let component: NoteEditorComponent;
  let fixture: ComponentFixture<NoteEditorComponent>;
  let notesService: NotesApiService;

  const mockNote = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    content: 'Existing note content',
    raw_content: 'Existing note content',
    created_at: new Date(),
    updated_at: new Date(),
    source: 'text'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteEditorComponent, HttpClientTestingModule, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(NoteEditorComponent);
    component = fixture.componentInstance;
    notesService = TestBed.inject(NotesApiService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Create Mode', () => {
    it('should save note on submit', () => {
      spyOn(notesService, 'createNote').and.returnValue(of(mockNote));

      component.content.set('Test note');
      component.saveNote();

      expect(notesService.createNote).toHaveBeenCalledWith({ content: 'Test note' });
    });

    it('should not be in edit mode when no route param', () => {
      fixture.detectChanges();
      expect(component.isEditMode()).toBe(false);
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      // Mock ActivatedRoute with id parameter
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [NoteEditorComponent, HttpClientTestingModule, RouterTestingModule],
        providers: [
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: {
                  get: (key: string) => key === 'id' ? mockNote.id : null
                }
              }
            }
          }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(NoteEditorComponent);
      component = fixture.componentInstance;
      notesService = TestBed.inject(NotesApiService);
    });

    it('should load note in edit mode', () => {
      spyOn(notesService, 'getNoteById').and.returnValue(of(mockNote));

      fixture.detectChanges(); // Triggers ngOnInit

      expect(notesService.getNoteById).toHaveBeenCalledWith(mockNote.id);
      expect(component.content()).toBe(mockNote.content);
      expect(component.isEditMode()).toBe(true);
    });

    it('should update note instead of creating when in edit mode', () => {
      spyOn(notesService, 'getNoteById').and.returnValue(of(mockNote));
      spyOn(notesService, 'updateNote').and.returnValue(of({ ...mockNote, content: 'Updated content' }));
      spyOn(notesService, 'createNote').and.returnValue(of(mockNote));

      fixture.detectChanges(); // Triggers ngOnInit to load note

      component.content.set('Updated content');
      component.saveNote();

      expect(notesService.updateNote).toHaveBeenCalledWith(mockNote.id, { content: 'Updated content' });
      expect(notesService.createNote).not.toHaveBeenCalled();
    });
  });
});
