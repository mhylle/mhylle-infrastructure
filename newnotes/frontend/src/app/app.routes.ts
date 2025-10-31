import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/notes',
    pathMatch: 'full'
  },
  {
    path: 'notes',
    loadComponent: () => import('./features/notes/note-list/note-list.component').then(m => m.NoteListComponent)
  },
  {
    path: 'notes/new',
    loadComponent: () => import('./features/notes/note-editor/note-editor.component').then(m => m.NoteEditorComponent)
  },
  {
    path: 'notes/edit/:id',
    loadComponent: () => import('./features/notes/note-editor/note-editor.component').then(m => m.NoteEditorComponent)
  },
  {
    path: 'notes/:id',
    loadComponent: () => import('./features/notes/note-detail/note-detail.component').then(m => m.NoteDetailComponent)
  },
  {
    path: 'tasks',
    loadComponent: () => import('./features/tasks/task-list/task-list.component').then(m => m.TaskListComponent)
  }
];
