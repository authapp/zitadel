/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Root directories for tests
  roots: ['<rootDir>/src', '<rootDir>/test'],
  
  // Test file patterns
  testMatch: ['**/*.test.ts'],
  
  // Module path aliases (matches tsconfig.json paths)
  moduleNameMapper: {
    '^@/zerrors/(.*)$': '<rootDir>/src/lib/zerrors/$1',
    '^@/(.*)$': '<rootDir>/src/lib/$1',
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Use Jest projects for separate unit and integration test configurations
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      moduleNameMapper: {
        '^@/zerrors/(.*)$': '<rootDir>/src/lib/zerrors/$1',
        '^@/(.*)$': '<rootDir>/src/lib/$1',
      },
      // Unit tests run in parallel for speed
      maxWorkers: '50%',
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
      moduleNameMapper: {
        '^@/zerrors/(.*)$': '<rootDir>/src/lib/zerrors/$1',
        '^@/(.*)$': '<rootDir>/src/lib/$1',
      },
      // CRITICAL: Force sequential execution for ALL integration tests
      maxWorkers: 1,
      maxConcurrency: 1,
      // Run tests serially within each file as well
      testRunner: 'jest-circus/runner',
      // Longer timeout for integration tests (in milliseconds)
      testTimeout: 30000,
    },
  ],
};