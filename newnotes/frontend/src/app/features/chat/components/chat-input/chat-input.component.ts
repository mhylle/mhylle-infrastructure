import { Component, input, output, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TextFieldModule } from '@angular/cdk/text-field';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TextFieldModule
  ],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.scss'
})
export class ChatInputComponent {
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;

  // Inputs
  disabled = input<boolean>(false);

  // Outputs
  messageSent = output<string>();

  // Local state
  message = signal('');

  onSendMessage(): void {
    const content = this.message().trim();

    if (content && !this.disabled()) {
      this.messageSent.emit(content);
      this.message.set('');

      // Reset textarea height
      if (this.messageInput) {
        this.messageInput.nativeElement.style.height = 'auto';
      }
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    // Send on Enter (without Shift)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  onInput(event: Event): void {
    // Auto-resize textarea
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  get canSend(): boolean {
    return this.message().trim().length > 0 && !this.disabled();
  }
}
