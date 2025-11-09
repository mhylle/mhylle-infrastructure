module.exports = {
  // Extend from the main jest configuration
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',

  // Only run integration tests
  testRegex: '.*\\.integration\\.spec\\.ts$',

  // Transform TypeScript files
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // Coverage configuration
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage-integration',

  // Test environment
  testEnvironment: 'node',

  // Increased timeout for LLM operations (60 seconds)
  testTimeout: 60000,

  // Module path aliases (same as main config)
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/core/$1',
    '^@features/(.*)$': '<rootDir>/features/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },

  // Setup files to run after environment is set up
  setupFilesAfterEnv: ['<rootDir>/test/setup-integration.ts'],

  // Display name for test suite
  displayName: {
    name: 'INTEGRATION',
    color: 'blue',
  },

  // Verbose output for integration tests
  verbose: true,

  // Run tests serially to avoid resource conflicts
  maxWorkers: 1,
};
