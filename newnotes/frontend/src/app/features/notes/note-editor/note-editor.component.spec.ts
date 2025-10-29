import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoteEditorComponent } from './note-editor.component';
import { NotesApiService } from '../../../core/services/notes-api.service';
import { of } from 'rxjs';

describe('NoteEditorComponent', () => {
  let component: NoteEditorComponent;
  let fixture: ComponentFixture<NoteEditorComponent>;
  let notesService: NotesApiService;

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

  it('should save note on submit', () => {
    const mockNote = {
      id: '1',
      content: 'Test note',
      raw_content: 'Test note',
      created_at: new Date(),
      updated_at: new Date(),
      source: 'text'
    };

    spyOn(notesService, 'createNote').and.returnValue(of(mockNote));

    component.content.set('Test note');
    component.saveNote();

    expect(notesService.createNote).toHaveBeenCalledWith({ content: 'Test note' });
  });
});
