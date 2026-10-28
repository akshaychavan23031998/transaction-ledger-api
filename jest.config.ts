import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/helpers/testEnv.ts'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/helpers/testEnv.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/helpers/database.ts'],
    },
    {
      displayName: 'concurrency',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/concurrency/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/helpers/testEnv.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/helpers/database.ts'],
    },
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/docs/openapi.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  maxWorkers: 1,
};

export default config;
