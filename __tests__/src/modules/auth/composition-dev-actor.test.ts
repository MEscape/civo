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
    MAIL_PROVIDER: 'none',
    LOG_LEVEL: 'error',
  },
}));
vi.mock('@lib/config', async (importOriginal) => ({
  // The identity is plain data other shared code reads at import time (the e-mail theme): keep it real.
  ...(await importOriginal<Record<string, unknown>>()),
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

describe('the website a request names, as the composition reads it', () => {
  const WEBSITE = '3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59';

  async function actorTenantWith(headerValue: string | null) {
    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue(
      new Headers(headerValue === null ? {} : { 'x-civo-tenant': headerValue }),
    );
    const { getAuthQueries } = await import('@modules/auth/composition');
    const result = await getAuthQueries().getCurrentActor.execute();
    return result._unsafeUnwrap().tenantId;
  }

  it(
    'works in the website its address names',
    async () => {
      await expect(actorTenantWith(WEBSITE)).resolves.toBe(WEBSITE);
    },
    IMPORT_TIMEOUT_MS,
  );

  it.each([
    'users',
    'audit',
    'platform',
    'unassigned',
    "'; DROP TABLE",
    `${WEBSITE.toUpperCase()}x`,
  ])(
    'ignores the header value %j: it is no website id',
    async (value) => {
      const withoutHeader = await actorTenantWith(null);

      await expect(actorTenantWith(value)).resolves.toBe(withoutHeader);
    },
    IMPORT_TIMEOUT_MS,
  );
});
