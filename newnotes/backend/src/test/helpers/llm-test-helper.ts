import axios from 'axios';

/**
 * LLM Test Helper Utilities
 *
 * Provides utilities for integration tests that interact with real LLM services (Ollama).
 */

/**
 * Default timeout for LLM API calls (30 seconds)
 */
export const LLM_TEST_TIMEOUT = 30000;

/**
 * Extended timeout for complex LLM operations (60 seconds)
 */
export const LLM_EXTENDED_TIMEOUT = 60000;

/**
 * Ollama API base URL
 */
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

/**
 * Check if Ollama service is running and accessible
 *
 * @returns Promise<boolean> True if Ollama is running, false otherwise
 */
export async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Skip test if Ollama is not running
 *
 * Usage:
 * ```typescript
 * beforeAll(async () => {
 *   await skipIfOllamaNotAvailable();
 * });
 * ```
 */
export async function skipIfOllamaNotAvailable(): Promise<void> {
  const running = await isOllamaRunning();
  if (!running) {
    console.warn('⚠️  Ollama is not running. Skipping integration tests.');
    console.warn(`   Make sure Ollama is running at ${OLLAMA_BASE_URL}`);
    console.warn('   You can start it with: ollama serve');
    // Using test.skip equivalent in Jest
    (global as any).SKIP_TESTS = true;
  }
}

/**
 * Check if a specific model is available in Ollama
 *
 * @param modelName Name of the model to check (e.g., 'llama3.2:1b')
 * @returns Promise<boolean> True if model is available
 */
export async function isModelAvailable(modelName: string): Promise<boolean> {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });

    if (response.status !== 200 || !response.data?.models) {
      return false;
    }

    return response.data.models.some(
      (model: any) => model.name === modelName || model.name.startsWith(modelName)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Validate that LLM response is reasonable
 *
 * @param response The response from LLM to validate
 * @param options Validation options
 * @returns boolean True if response is valid
 */
export function validateLLMResponse(
  response: any,
  options: {
    shouldBeJSON?: boolean;
    minLength?: number;
    maxLength?: number;
    shouldContain?: string[];
    shouldNotBeEmpty?: boolean;
  } = {}
): boolean {
  const {
    shouldBeJSON = false,
    minLength = 0,
    maxLength = Infinity,
    shouldContain = [],
    shouldNotBeEmpty = true,
  } = options;

  // Check if response exists
  if (response === null || response === undefined) {
    return false;
  }

  // Convert to string for validation
  const responseStr = typeof response === 'string' ? response : JSON.stringify(response);

  // Check if empty (when required)
  if (shouldNotBeEmpty && responseStr.trim().length === 0) {
    return false;
  }

  // Check length constraints
  if (responseStr.length < minLength || responseStr.length > maxLength) {
    return false;
  }

  // Check if valid JSON (when required)
  if (shouldBeJSON) {
    try {
      JSON.parse(responseStr);
    } catch (error) {
      return false;
    }
  }

  // Check if contains required strings
  if (shouldContain.length > 0) {
    const lowerResponse = responseStr.toLowerCase();
    const hasAllRequired = shouldContain.every(
      (term) => lowerResponse.includes(term.toLowerCase())
    );
    if (!hasAllRequired) {
      return false;
    }
  }

  return true;
}

/**
 * Wait for LLM service to be ready
 *
 * @param maxAttempts Maximum number of connection attempts
 * @param delayMs Delay between attempts in milliseconds
 * @returns Promise<boolean> True if service becomes ready
 */
export async function waitForOllama(
  maxAttempts = 10,
  delayMs = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const running = await isOllamaRunning();
    if (running) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

/**
 * Get list of available models in Ollama
 *
 * @returns Promise<string[]> Array of model names
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });

    if (response.status !== 200 || !response.data?.models) {
      return [];
    }

    return response.data.models.map((model: any) => model.name);
  } catch (error) {
    return [];
  }
}

/**
 * Assert that Ollama is running, or skip the test
 * Use this in describe blocks
 */
export function describeIfOllama(name: string, fn: () => void): void {
  describe(name, () => {
    let ollamaAvailable = false;

    beforeAll(async () => {
      ollamaAvailable = await isOllamaRunning();
      if (!ollamaAvailable) {
        console.warn(`⚠️  Skipping "${name}" - Ollama not available`);
      }
    });

    beforeEach(function() {
      if (!ollamaAvailable) {
        this.skip();
      }
    });

    fn();
  });
}
