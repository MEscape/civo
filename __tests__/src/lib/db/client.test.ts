import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const warn = vi.fn();
  const error = vi.fn();
  const poolInstances: Array<{
    options: Record<string, unknown>;
    ending: boolean;
    end: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  }> = [];
  const client = { close: vi.fn() };
  const postgres = vi.fn((_options: Record<string, unknown>) => client);
  const env = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
    DATABASE_POOL_SIZE: 4,
    DATABASE_POOL_TIMEOUT_SECONDS: 7,
    DATABASE_STATEMENT_TIMEOUT_SECONDS: 20,
    NODE_ENV: 'development' as 'development' | 'production',
  };
  return { warn, error, poolInstances, client, postgres, env };
});

vi.mock('pg', () => ({
  Pool: class {
    ending = false;
    end = vi.fn(() => {
      this.ending = true;
      return Promise.resolve();
    });
    on = vi.fn();
    constructor(readonly options: Record<string, unknown>) {
      mocks.poolInstances.push(this);
    }
  },
}));
vi.mock('@prisma/orm-postgres/runtime', () => ({ default: mocks.postgres }));
vi.mock('temporal-polyfill/global', () => ({}));
vi.mock('@lib/config/server', () => ({ serverEnv: mocks.env }));
vi.mock('@lib/logger', () => ({
  logger: {
    withContext: () => ({ warn: mocks.warn, error: mocks.error, debug: vi.fn(), info: vi.fn() }),
  },
}));

async function loadClient() {
  vi.resetModules();
  return import('@lib/db/client');
}

describe('db client', () => {
  beforeEach(() => {
    mocks.poolInstances.length = 0;
    mocks.env.NODE_ENV = 'development';
    mocks.client.close.mockReset().mockResolvedValue(undefined);
    mocks.postgres.mockClear();
    mocks.warn.mockClear();
    mocks.error.mockClear();
    Reflect.deleteProperty(globalThis, 'database');
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'database');
  });

  it('sizes the pool from the configuration and hands it to the runtime', async () => {
    const { db } = await loadClient();

    expect(mocks.poolInstances).toHaveLength(1);
    const [pool] = mocks.poolInstances;
    expect(pool?.options).toEqual({
      connectionString: mocks.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 7000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 20_000,
      application_name: 'civo',
    });
    expect(mocks.postgres).toHaveBeenCalledWith(
      expect.objectContaining({
        pg: pool,
        contract: expect.objectContaining({ target: 'postgres', targetFamily: 'sql' }),
      }),
    );
    expect(db).toBe(mocks.client);
  });

  it('logs a connection the server dropped while idle instead of crashing the process', async () => {
    await loadClient();

    const [call] = mocks.poolInstances[0]?.on.mock.calls ?? [];
    expect(call?.[0]).toBe('error');
    (call?.[1] as (error: Error) => void)(new Error('terminating connection'));

    expect(mocks.warn).toHaveBeenCalledWith('db.pool.idle_connection_failed', {
      reason: 'terminating connection',
    });
  });

  it('reuses the database across module reloads outside production', async () => {
    await loadClient();
    await loadClient();

    expect(mocks.poolInstances).toHaveLength(1);
  });

  it('builds a new database per module instance in production', async () => {
    mocks.env.NODE_ENV = 'production';

    await loadClient();
    await loadClient();

    expect(mocks.poolInstances).toHaveLength(2);
  });

  it('closes the client, then ends the pool, and may be called twice', async () => {
    const { disconnectDb } = await loadClient();

    await disconnectDb();
    await disconnectDb();

    const pool = mocks.poolInstances[0];
    expect(mocks.client.close).toHaveBeenCalledTimes(2);
    expect(pool?.end).toHaveBeenCalledTimes(1);
  });

  it('logs and rethrows a failed disconnect', async () => {
    const failure = new Error('close failed');
    mocks.client.close.mockRejectedValue(failure);
    const { disconnectDb } = await loadClient();

    await expect(disconnectDb()).rejects.toBe(failure);
    expect(mocks.error).toHaveBeenCalledWith('db.disconnect_failed', failure);
  });
});
