import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, ActivatedRoute } from '@angular/router';
import { NotesApiService } from '../../../core/services/notes-api.service';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './note-editor.component.html',
  styleUrl: './note-editor.component.css'
})
export class NoteEditorComponent implements OnInit {
  noteId = signal<string | null>(null);
  content = signal('');
  saving = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  isEditMode = computed(() => !!this.noteId());

  constructor(
    private notesService: NotesApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.noteId.set(id);
      this.loadNote();
    }
  }

  loadNote(): void {
    const id = this.noteId();
    if (!id) return;

    this.loading.set(true);
    this.error.set(null);

    this.notesService.getNoteById(id).subscribe({
      next: (note) => {
        this.content.set(note.content);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load note');
        this.loading.set(false);
        console.error('Error loading note:', err);
      }
    });
  }

  saveNote(): void {
    const trimmedContent = this.content().trim();

    if (!trimmedContent) {
      this.error.set('Note content cannot be empty');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const noteId = this.noteId();
    const operation = noteId
      ? this.notesService.updateNote(noteId, { content: trimmedContent })
      : this.notesService.createNote({ content: trimmedContent });

    operation.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/notes']);
      },
      error: (err) => {
        this.error.set('Failed to save note');
        this.saving.set(false);
        console.error('Error saving note:', err);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/notes']);
  }
}
