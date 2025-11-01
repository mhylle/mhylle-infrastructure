import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ChatSession } from '../../models/chat-session.model';

@Component({
  selector: 'app-session-list',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './session-list.component.html',
  styleUrl: './session-list.component.scss'
})
export class SessionListComponent {
  // Inputs
  sessions = input.required<ChatSession[]>();
  currentSessionId = input<string | null>(null);

  // Outputs
  sessionSelected = output<string>();
  newSession = output<void>();
  sessionDeleted = output<string>();

  constructor(private dialog: MatDialog) {}

  onSelectSession(sessionId: string): void {
    this.sessionSelected.emit(sessionId);
  }

  onNewSession(): void {
    this.newSession.emit();
  }

  onDeleteSession(event: Event, sessionId: string): void {
    event.stopPropagation();

    // Simple confirmation (in production, use a proper dialog)
    if (confirm('Are you sure you want to delete this chat session?')) {
      this.sessionDeleted.emit(sessionId);
    }
  }

  getSessionTitle(session: ChatSession): string {
    return session.title || 'New Chat';
  }

  formatDate(date: Date): string {
    const now = new Date();
    const sessionDate = new Date(date);
    const diffMs = now.getTime() - sessionDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return sessionDate.toLocaleDateString();
  }
}
