import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
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
export class NoteEditorComponent {
  content = signal('');
  saving = signal(false);
  error = signal<string | null>(null);

  constructor(
    private notesService: NotesApiService,
    private router: Router
  ) {}

  saveNote(): void {
    const trimmedContent = this.content().trim();

    if (!trimmedContent) {
      this.error.set('Note content cannot be empty');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.notesService.createNote({ content: trimmedContent }).subscribe({
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
