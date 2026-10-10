import { defineConfig } from 'vitest/config';

/**
 * Tests that need a real database (`*.integration.test.ts`); the ordinary
 * configuration excludes them. `BOOKING_TEST_DATABASE_URL` replaces the
 * placeholder `DATABASE_URL`: the server configuration is read once, when it
 * is first imported, so the value has to be set here and not in a test file.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.integration.test.ts'],
    env: {
      DATABASE_URL:
        process.env['BOOKING_TEST_DATABASE_URL'] ?? 'postgresql://user:pass@localhost:5432/test',
      AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/test_auth',
      AUTH_SECRET: 'x'.repeat(40),
    },
    server: { deps: { inline: ['next-intl'] } },
    // One database, several files: run them one after the other.
    fileParallelism: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
});
