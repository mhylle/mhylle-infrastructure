/**
 * Integration Test Setup
 *
 * This file runs before each integration test suite.
 * It checks for required services (Ollama) and provides helpful error messages.
 */

import { isOllamaRunning, OLLAMA_BASE_URL } from './helpers/llm-test-helper';

beforeAll(async () => {
  const ollamaAvailable = await isOllamaRunning();

  if (!ollamaAvailable) {
    console.warn('');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('⚠️  WARNING: Ollama service is not available');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('');
    console.warn('Integration tests require Ollama to be running.');
    console.warn(`Expected URL: ${OLLAMA_BASE_URL}`);
    console.warn('');
    console.warn('To start Ollama:');
    console.warn('  1. Install Ollama from https://ollama.ai');
    console.warn('  2. Run: ollama serve');
    console.warn('  3. Pull required models: ollama pull llama3.2:1b');
    console.warn('');
    console.warn('Tests that require Ollama will be skipped.');
    console.warn('═══════════════════════════════════════════════════════════════');
    console.warn('');
  } else {
    console.log('✅ Ollama service is available');
  }
});

// Set global timeout for all integration tests
jest.setTimeout(60000);
