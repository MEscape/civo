import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.integration.test.ts'],
    env: {
      // CI brings its own migrated database; locally create `test` (owner `user`) and migrate it.
      DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://user:pass@localhost:5432/test',
      AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/test_auth',
      AUTH_SECRET: 'x'.repeat(40),
    },
    // next-intl ships ESM with extensionless `next/*` imports; Vite must resolve them.
    server: { deps: { inline: ['next-intl'] } },
    // One database, several files: run them one after the other.
    fileParallelism: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
});
