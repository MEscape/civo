import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // The server environment is validated when `@lib/config` is first imported, so any
    // test that touches module code needs a valid one. These are placeholders, not services:
    // nothing here connects to a database.
    env: {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/test_auth',
      AUTH_SECRET: 'x'.repeat(40),
    },
    // next-intl ships ESM with extensionless `next/*` imports; Vite must resolve them.
    server: { deps: { inline: ['next-intl'] } },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
