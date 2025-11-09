/**
 * Example Integration Test
 *
 * This is a simple example showing how to write integration tests
 * that interact with Ollama LLM service.
 */

import {
  describeIfOllama,
  isOllamaRunning,
  isModelAvailable,
  validateLLMResponse,
  getAvailableModels,
  LLM_TEST_TIMEOUT,
} from '../helpers/llm-test-helper';

describeIfOllama('Example Integration Tests', () => {
  it('should connect to Ollama service', async () => {
    const running = await isOllamaRunning();
    expect(running).toBe(true);
  });

  it('should list available models', async () => {
    const models = await getAvailableModels();
    expect(Array.isArray(models)).toBe(true);
    console.log('Available models:', models);
  });

  it('should validate non-empty responses', () => {
    const validResponse = 'This is a valid LLM response';
    const invalidResponse = '';

    expect(
      validateLLMResponse(validResponse, { shouldNotBeEmpty: true })
    ).toBe(true);

    expect(
      validateLLMResponse(invalidResponse, { shouldNotBeEmpty: true })
    ).toBe(false);
  });

  it('should validate response length', () => {
    const response = 'This is a test response';

    expect(
      validateLLMResponse(response, { minLength: 5, maxLength: 100 })
    ).toBe(true);

    expect(
      validateLLMResponse(response, { minLength: 50 })
    ).toBe(false);
  });

  it('should validate JSON responses', () => {
    const validJSON = '{"key": "value"}';
    const invalidJSON = '{invalid json}';

    expect(
      validateLLMResponse(validJSON, { shouldBeJSON: true })
    ).toBe(true);

    expect(
      validateLLMResponse(invalidJSON, { shouldBeJSON: true })
    ).toBe(false);
  });

  it('should validate response contains specific terms', () => {
    const response = 'The quick brown fox jumps over the lazy dog';

    expect(
      validateLLMResponse(response, { shouldContain: ['fox', 'dog'] })
    ).toBe(true);

    expect(
      validateLLMResponse(response, { shouldContain: ['cat', 'mouse'] })
    ).toBe(false);
  });

  // This test demonstrates a longer-running operation
  it('should handle timeout for long operations', async () => {
    // Simulate a long-running operation
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(true).toBe(true);
  }, LLM_TEST_TIMEOUT);
});

// This test suite will run without Ollama requirement
describe('Helper Utilities (no Ollama required)', () => {
  it('should validate responses with default options', () => {
    expect(validateLLMResponse('test')).toBe(true);
    expect(validateLLMResponse('')).toBe(false);
    expect(validateLLMResponse(null)).toBe(false);
    expect(validateLLMResponse(undefined)).toBe(false);
  });
});
