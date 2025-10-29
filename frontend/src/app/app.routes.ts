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
  }
];
