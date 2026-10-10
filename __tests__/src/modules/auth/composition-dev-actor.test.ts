import { describe, expect, it, vi } from 'vitest';

/** The composition root pulls in the whole auth module graph; loading it is slow under parallel load. */
const IMPORT_TIMEOUT_MS = 30_000;

const connection = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('next/server', () => ({ connection }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@lib/config/server', () => ({
  serverEnv: {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    DATABASE_POOL_SIZE: 1,
    DATABASE_POOL_TIMEOUT_SECONDS: 1,
    AUTH_ENABLED: false,
    AUTH_DEV_ACTOR_ROLE: 'viewer',
    AUTH_MAIL_PROVIDER: 'none',
    LOG_LEVEL: 'error',
  },
}));
vi.mock('@lib/config', () => ({
  APP_IDENTITY: { name: 'Civo' },
  publicEnv: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' },
}));

/**
 * With auth off the dev actor reads no request data, so a protected page
 * prerendered and ran its database queries at build time; Prisma's driver
 * then drew a random UUID, which Cache Components rejects while prerendering.
 */
describe('auth composition with AUTH_ENABLED=false', () => {
  it(
    'resolves the dev actor only at request time',
    async () => {
      const { getAuthQueries } = await import('@modules/auth/composition');

      const result = await getAuthQueries().getCurrentActor.execute();

      expect(connection).toHaveBeenCalledTimes(1);
      expect(result.isOk()).toBe(true);
    },
    IMPORT_TIMEOUT_MS,
  );
});
