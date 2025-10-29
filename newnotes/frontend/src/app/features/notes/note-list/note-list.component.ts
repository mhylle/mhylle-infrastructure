import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { NotesApiService } from '../../../core/services/notes-api.service';
import { Note } from '../../../core/models/note.model';

@Component({
  selector: 'app-note-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './note-list.component.html',
  styleUrl: './note-list.component.css'
})
export class NoteListComponent implements OnInit {
  notes = signal<Note[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private notesService: NotesApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    this.loading.set(true);
    this.error.set(null);

    this.notesService.getNotes().subscribe({
      next: (notes) => {
        this.notes.set(notes);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load notes');
        this.loading.set(false);
        console.error('Error loading notes:', err);
      }
    });
  }

  createNote(): void {
    this.router.navigate(['/notes/new']);
  }

  editNote(id: string): void {
    this.router.navigate(['/notes/edit', id]);
  }
}
