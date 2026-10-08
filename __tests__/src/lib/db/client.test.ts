import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 1. Mock the configuration to control database connection parameters
vi.mock('@lib/config', () => ({
  serverEnv: {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/mydb',
    DATABASE_POOL_SIZE: 15,
    DATABASE_POOL_TIMEOUT_SECONDS: 10,
    NODE_ENV: 'development',
  },
}));

// 2. Mock the Prisma ORM runtime factory
vi.mock('@prisma/orm-postgres/runtime', () => ({
  default: vi.fn(() => ({
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

// 3. Mock the local dependencies (middleware and generated contract)
vi.mock('@lib/db/query-logger', () => ({
  queryLogger: vi.fn(() => 'mocked-query-logger-middleware'),
}));

vi.mock('@lib/db/contract.json', () => ({
  default: { mock: 'contract-data' },
}));

// 4. Mock the logger to capture infrastructure errors
vi.mock('@lib/logger', () => {
  const mockDbLogger = { error: vi.fn() };
  return {
    logger: {
      withContext: vi.fn(() => mockDbLogger),
    },
  };
});

describe('Database infrastructure adapter', () => {
  beforeEach(() => {
    // Reset module registry so each test evaluates the top-level module code independently
    vi.resetModules();

    // Clear the Next.js development hot-reload cache
    delete (globalThis as any).prisma;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes the Prisma Postgres client with the connection URL and middleware', async () => {
    const postgres = (await import('@prisma/orm-postgres/runtime')).default;
    const { db } = await import('@lib/db');

    expect(postgres).toHaveBeenCalledTimes(1);
    expect(postgres).toHaveBeenCalledWith({
      contractJson: { mock: 'contract-data' },
      // Asserts that pool limits are correctly appended to the base URL
      url: 'postgresql://user:password@localhost:5432/mydb?connection_limit=15&pool_timeout=10',
      middleware: ['mocked-query-logger-middleware'],
    });

    expect(db).toBeDefined();
  });

  it('caches the client instance on globalThis in non-production environments to prevent pool exhaustion', async () => {
    const postgres = (await import('@prisma/orm-postgres/runtime')).default;

    // First import initializes the client and caches it
    await import('@lib/db');
    expect(postgres).toHaveBeenCalledTimes(1);
    expect((globalThis as any).prisma).toBeDefined();

    // Resetting modules simulates a Next.js hot module reload
    vi.resetModules();

    // Second import should reuse the global instance instead of creating a new one
    await import('@lib/db');
    expect(postgres).toHaveBeenCalledTimes(1);
  });

  it('does not cache the client instance on globalThis in production environments', async () => {
    const { serverEnv } = await import('@lib/config');
    serverEnv.NODE_ENV = 'production';

    await import('@lib/db');

    expect((globalThis as any).prisma).toBeUndefined();

    // Restore the environment variable for subsequent tests
    serverEnv.NODE_ENV = 'development';
  });

  describe('disconnectDb', () => {
    it('gracefully closes the database connection', async () => {
      const { db, disconnectDb } = await import('@lib/db');

      await disconnectDb();

      expect(db.close).toHaveBeenCalledTimes(1);
    });

    it('logs and rethrows if closing the connection fails', async () => {
      const { db, disconnectDb } = await import('@lib/db');
      const { logger } = await import('@lib/logger');

      const dbLogger = logger.withContext({ module: 'infrastructure.prisma' });
      const error = new Error('Connection unexpectedly lost');

      (db.close as any).mockRejectedValueOnce(error);

      await expect(disconnectDb()).rejects.toThrow('Connection unexpectedly lost');
      expect(dbLogger.error).toHaveBeenCalledWith('db.disconnect_failed', error);
    });
  });
});
