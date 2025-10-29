import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotesApiService } from './notes-api.service';
import { Note, CreateNoteDto } from '../models/note.model';

describe('NotesApiService', () => {
  let service: NotesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotesApiService]
    });
    service = TestBed.inject(NotesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all notes', () => {
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

    service.getNotes().subscribe(notes => {
      expect(notes.length).toBe(1);
      expect(notes[0].content).toBe('Test note');
    });

    const req = httpMock.expectOne('http://localhost:3005/api/notes/notes');
    expect(req.request.method).toBe('GET');
    req.flush(mockNotes);
  });

  it('should create a note', () => {
    const createDto: CreateNoteDto = { content: 'New note' };
    const mockNote: Note = {
      id: '1',
      content: 'New note',
      raw_content: 'New note',
      created_at: new Date(),
      updated_at: new Date(),
      source: 'text'
    };

    service.createNote(createDto).subscribe(note => {
      expect(note.content).toBe('New note');
    });

    const req = httpMock.expectOne('http://localhost:3005/api/notes/notes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createDto);
    req.flush(mockNote);
  });

  it('should get a note by id', () => {
    const mockNote: Note = {
      id: '1',
      content: 'Test note',
      raw_content: 'Test note',
      created_at: new Date(),
      updated_at: new Date(),
      source: 'text'
    };

    service.getNoteById('1').subscribe(note => {
      expect(note.id).toBe('1');
      expect(note.content).toBe('Test note');
    });

    const req = httpMock.expectOne('http://localhost:3005/api/notes/notes/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockNote);
  });

  it('should update a note', () => {
    const updateDto: Partial<CreateNoteDto> = { content: 'Updated note' };
    const mockNote: Note = {
      id: '1',
      content: 'Updated note',
      raw_content: 'Updated note',
      created_at: new Date(),
      updated_at: new Date(),
      source: 'text'
    };

    service.updateNote('1', updateDto).subscribe(note => {
      expect(note.content).toBe('Updated note');
    });

    const req = httpMock.expectOne('http://localhost:3005/api/notes/notes/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(updateDto);
    req.flush(mockNote);
  });

  it('should delete a note', () => {
    service.deleteNote('1').subscribe();

    const req = httpMock.expectOne('http://localhost:3005/api/notes/notes/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
