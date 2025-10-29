import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoteListComponent } from './note-list.component';
import { NotesApiService } from '../../../core/services/notes-api.service';
import { of } from 'rxjs';
import { Note } from '../../../core/models/note.model';

describe('NoteListComponent', () => {
  let component: NoteListComponent;
  let fixture: ComponentFixture<NoteListComponent>;
  let notesService: NotesApiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteListComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(NoteListComponent);
    component = fixture.componentInstance;
    notesService = TestBed.inject(NotesApiService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load notes on init', () => {
    const mockNotes: Note[] = [
      {
        id: '1',
        content: 'Test note',
        raw_content: 'Test note',
        created_at: new Date(),
        updated_at: new Date(),
        source: 'text'
      }
    ];

    spyOn(notesService, 'getNotes').and.returnValue(of(mockNotes));

    component.ngOnInit();

    expect(notesService.getNotes).toHaveBeenCalled();
    expect(component.notes().length).toBe(1);
  });
});
