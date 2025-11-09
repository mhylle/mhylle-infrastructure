# Test Infrastructure

This directory contains test utilities and infrastructure for the notes backend application.

## Directory Structure

```
src/test/
├── helpers/              # Test helper utilities
│   └── llm-test-helper.ts   # LLM integration test utilities
├── integration/          # Integration test examples and documentation
│   ├── README.md            # Integration testing guide
│   └── example.integration.spec.ts  # Example integration tests
└── setup-integration.ts  # Setup file for integration tests
```

## Test Types

### Unit Tests (`*.spec.ts`)
- Fast, isolated tests
- Mock all external dependencies
- Run with: `npm test`
- Configuration: `package.json` jest section

### Integration Tests (`*.integration.spec.ts`)
- Test with real external services (Ollama)
- Slower execution (30-60s per test)
- Run with: `npm run test:integration`
- Configuration: `jest.integration.config.js`

### E2E Tests (`*.e2e-spec.ts`)
- Full application testing
- Run with: `npm run test:e2e`
- Configuration: `test/jest-e2e.json`

## Quick Start

### Running Tests

```bash
# Unit tests
npm test

# Integration tests (requires Ollama)
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:cov
```

### Writing Integration Tests

See [integration/README.md](./integration/README.md) for detailed guide.

Quick example:

```typescript
import { describeIfOllama, validateLLMResponse, LLM_TEST_TIMEOUT } from '@test/helpers/llm-test-helper';

describeIfOllama('My Service Integration Tests', () => {
  it('should work with real LLM', async () => {
    const result = await myService.generateText('prompt');
    expect(validateLLMResponse(result)).toBe(true);
  }, LLM_TEST_TIMEOUT);
});
```

## Helper Utilities

### LLM Test Helper

Located at `helpers/llm-test-helper.ts`, provides:

- `describeIfOllama()` - Auto-skip tests if Ollama not available
- `isOllamaRunning()` - Check Ollama service status
- `validateLLMResponse()` - Validate LLM output quality
- `LLM_TEST_TIMEOUT` - Standard timeout constants

## Path Aliases

The project uses TypeScript path aliases:

```typescript
import { something } from '@core/...';     // src/core/
import { something } from '@features/...'; // src/features/
import { something } from '@shared/...';   // src/shared/
import { something } from '@test/...';     // src/test/
```

## Best Practices

1. **Keep unit tests fast** - Mock all external dependencies
2. **Use integration tests sparingly** - Only for critical LLM interactions
3. **Name tests clearly** - Describe what behavior is being tested
4. **One assertion per test** - Makes failures easier to diagnose
5. **Use helpers** - Leverage test utilities for consistency

## Continuous Integration

- Unit tests run on every commit
- Integration tests may run less frequently (nightly builds)
- E2E tests run before deployment

## Troubleshooting

### Tests won't run
```bash
# Clear jest cache
npm test -- --clearCache

# Rebuild
npm run build
```

### Integration tests failing
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Path resolution errors
Check `tsconfig.json` paths match `moduleNameMapper` in jest config.

## Further Reading

- [Jest Documentation](https://jestjs.io/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Integration Tests Guide](./integration/README.md)
