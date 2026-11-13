import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,

    // Integration tests require a database and run separately via `npm run test:integration`.
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],

    setupFiles: ['./vitest.setup.ts'],

    // Component tests may take 1–2 seconds alone and significantly longer under worker contention.
    // A 15-second timeout avoids flaky failures caused by parallel test execution.
    testTimeout: 15_000,

    // Required when server-side configuration is imported during tests.
    // These are placeholders; unit tests must not connect to a real database.
    env: {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/test_auth',
      AUTH_SECRET: 'x'.repeat(40),
      // Unit tests must not reach Redis; limiter logic is tested with a store the test controls.
      RATE_LIMIT_ENABLED: 'false',
      // Storage cannot be switched off; nothing in a unit test talks to it.
      STORAGE_S3_ENDPOINT: 'http://localhost:8333',
      STORAGE_S3_ACCESS_KEY_ID: 'test',
      STORAGE_S3_SECRET_ACCESS_KEY: 'test',
      STORAGE_S3_PRIVATE_BUCKET: 'civo-test-private',
    },

    coverage: {
      provider: 'v8',

      // Measure coverage for all TypeScript and TSX source files under src.
      include: ['src/**/*.{ts,tsx}'],

      // Type declarations contain no executable code and should not affect coverage.
      exclude: ['**/*.d.ts'],

      // Print a concise terminal summary and generate machine-readable summary data.
      reporter: ['text-summary', 'json-summary'],

      thresholds: {
        // Require at least 80% overall coverage for every metric.
        // The coverage command fails if any of these thresholds is not met.
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,

        // The shared library has a stricter requirement: 100% coverage.
        // Keep this threshold to prevent regressions in core, reusable functionality.
        'src/lib/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },

    // next-intl uses extensionless imports into Next.js modules.
    // Inline it so Vite can resolve those imports correctly in tests.
    server: {
      deps: {
        inline: ['next-intl'],
      },
    },
  },

  // Resolve TypeScript path aliases using the project's tsconfig.
  resolve: {
    tsconfigPaths: true,
  },
});
