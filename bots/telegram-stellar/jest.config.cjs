/** @type {import('jest').Config} */
const config = {
  // Use ts-jest to compile TypeScript on the fly
  preset: 'ts-jest',

  // Node environment (bot is Node.js, not browser)
  testEnvironment: 'node',

  // Tell Jest where to find tests
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],

  // TypeScript transformation via ts-jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Override module to CommonJS for Jest compatibility
          // (the source uses NodeNext/ESM but Jest needs CJS)
          module: 'CommonJS',
          moduleResolution: 'node',
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },

  // Module name mapper — handles .js extensions in ESM imports
  moduleNameMapper: {
    // Strip .js extensions so Jest can find .ts files
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/anchor/stellarService.ts',
    'src/interval-parser.ts',
    'src/contractLogger.ts',
    'src/usersExport.ts',
  ],

  // Show verbose output per test
  verbose: true,

  // Timeout per test (Horizon mocks can be slow if misconfigured)
  testTimeout: 10000,
};

module.exports = config;
