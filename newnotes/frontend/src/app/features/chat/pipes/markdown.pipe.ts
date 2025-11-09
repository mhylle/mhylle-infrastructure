import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

/**
 * Markdown pipe for rendering markdown content safely.
 * Converts markdown syntax to HTML and sanitizes the output.
 */
@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {
    // Configure marked options
    marked.setOptions({
      breaks: true, // Convert \n to <br>
      gfm: true // GitHub Flavored Markdown
    });
  }

  transform(value: string): SafeHtml {
    if (!value) {
      return '';
    }

    try {
      // Strip <think> sections (AI internal reasoning)
      let cleaned = value.replace(/<think>[\s\S]*?<\/think>/gi, '');

      // Trim leading/trailing whitespace
      cleaned = cleaned.trim();

      // Remove [Searching the web...] prefix (with optional leading whitespace)
      cleaned = cleaned.replace(/^\s*\[Searching the web\.\.\.\]\s*/i, '');

      // Remove any other [Action...] prefixes at the start
      cleaned = cleaned.replace(/^\s*\[[^\]]+\.\.\.\]\s*/gi, '');

      // Trim again after removals
      cleaned = cleaned.trim();

      // Parse markdown to HTML
      const html = marked.parse(cleaned) as string;

      // Sanitize and return safe HTML
      return this.sanitizer.sanitize(1, html) || '';
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return value; // Return original text if parsing fails
    }
  }
}
