import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.integration.test.ts'],
    env: {
      // CI brings its own migrated database; locally create `test` (owner `user`) and migrate it.
      DATABASE_URL: process.env['DATABASE_URL'],
      AUTH_DATABASE_URL: process.env['AUTH_DATABASE_URL'],
      AUTH_SECRET: process.env['AUTH_SECRET'],
      // The Redis integration test builds its own store from RATE_LIMIT_TEST_REST_*.
      RATE_LIMIT_ENABLED: 'false',
      // Storage cannot be switched off; nothing in a unit test talks to it.
      STORAGE_S3_ENDPOINT: 'http://localhost:8333',
      STORAGE_S3_ACCESS_KEY_ID: 'test',
      STORAGE_S3_SECRET_ACCESS_KEY: 'test',
      STORAGE_S3_PRIVATE_BUCKET: 'civo-test-private',
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
