# Integration Tests

This directory contains integration tests that interact with real external services, specifically LLM services via Ollama.

## What are Integration Tests?

Integration tests verify that different parts of the application work correctly together with real external dependencies. Unlike unit tests which mock external services, integration tests:

- Call real LLM services (Ollama)
- Test actual API responses and behaviors
- Verify end-to-end functionality
- Take longer to run (typically 30-60 seconds per test)

## How to Run Integration Tests

### Prerequisites

1. **Install Ollama**
   ```bash
   # Visit https://ollama.ai for installation instructions
   # Or on macOS:
   brew install ollama
   ```

2. **Start Ollama Service**
   ```bash
   ollama serve
   ```

3. **Pull Required Models**
   ```bash
   ollama pull llama3.2:1b
   ollama pull qwen3:0.6b
   ```

### Running the Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm run test:integration -- local-model.service.integration.spec.ts

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode
npm run test:integration -- --watch
```

## Writing Integration Tests

Integration test files should be named with the `.integration.spec.ts` suffix.

### Basic Structure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { describeIfOllama, validateLLMResponse, LLM_TEST_TIMEOUT } from '@test/helpers/llm-test-helper';
import { YourService } from './your.service';

describeIfOllama('YourService Integration Tests', () => {
  let service: YourService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YourService],
    }).compile();

    service = module.get<YourService>(YourService);
  });

  it('should generate valid response from LLM', async () => {
    const result = await service.generateResponse('test prompt');

    expect(validateLLMResponse(result, {
      shouldNotBeEmpty: true,
      minLength: 10,
    })).toBe(true);
  }, LLM_TEST_TIMEOUT);
});
```

### Available Test Helpers

Located in `src/test/helpers/llm-test-helper.ts`:

- **`describeIfOllama()`** - Automatically skips test suite if Ollama is not available
- **`isOllamaRunning()`** - Check if Ollama service is accessible
- **`isModelAvailable(modelName)`** - Check if a specific model is pulled
- **`validateLLMResponse(response, options)`** - Validate LLM response quality
- **`waitForOllama()`** - Wait for Ollama to become ready
- **`getAvailableModels()`** - Get list of pulled models

### Timeout Constants

- **`LLM_TEST_TIMEOUT`** - 30 seconds (default for LLM operations)
- **`LLM_EXTENDED_TIMEOUT`** - 60 seconds (for complex operations)

## Differences from Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| **External Services** | Mocked | Real (Ollama) |
| **Speed** | Fast (<1s) | Slow (30-60s) |
| **Isolation** | Complete | Partial |
| **Configuration** | `jest.config.js` | `jest.integration.config.js` |
| **File Pattern** | `*.spec.ts` | `*.integration.spec.ts` |
| **When to Run** | Every commit | Before merge/deploy |
| **Dependencies** | None | Ollama service required |

## Test Configuration

Integration tests use a separate Jest configuration (`jest.integration.config.js`) with:

- 60-second timeout (vs 5s for unit tests)
- Serial execution (maxWorkers: 1) to avoid resource conflicts
- Separate coverage directory
- Setup file that checks for Ollama availability

## Best Practices

1. **Use `describeIfOllama()`** - Always wrap test suites to handle missing Ollama gracefully
2. **Set Appropriate Timeouts** - Use `LLM_TEST_TIMEOUT` or `LLM_EXTENDED_TIMEOUT`
3. **Validate Responses** - Use `validateLLMResponse()` to ensure quality
4. **Test Real Scenarios** - Focus on actual use cases, not edge cases
5. **Keep Tests Independent** - Each test should work standalone
6. **Document Model Requirements** - Specify which models tests need

## CI/CD Considerations

Integration tests are typically:

- Run in a separate CI job from unit tests
- Require Ollama service in the CI environment
- May be run less frequently (e.g., nightly builds)
- Should not block fast feedback loops

## Troubleshooting

### Ollama Not Available
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Model Not Found
```bash
# List available models
ollama list

# Pull required model
ollama pull llama3.2:1b
```

### Tests Timing Out
- Increase timeout in test: `it('test', async () => {...}, 90000)`
- Check Ollama performance: `ollama run llama3.2:1b "test"`
- Reduce test complexity or model size

### Port Conflicts
- Default port is 11434
- Set custom port: `OLLAMA_BASE_URL=http://localhost:8080 npm run test:integration`

## Examples

See the following files for integration test examples:

- `src/features/llm-service/services/local-model.service.integration.spec.ts` (to be created)
- Additional examples as services are tested

## Further Reading

- [Jest Documentation](https://jestjs.io/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
