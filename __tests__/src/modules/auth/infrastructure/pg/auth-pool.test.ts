import { describe, expect, it } from 'vitest';

import { getAuthPool } from '@modules/auth/infrastructure/pg/auth-pool';

describe('auth database pool', () => {
  it('bounds connection waits and statements using the supplied database budgets', async () => {
    const pool = getAuthPool({
      databaseUrl: 'postgresql://user:pass@localhost:5432/test_auth',
      maxConnections: 3,
      reuseAcrossReloads: false,
      connectionTimeoutMs: 2_000,
      statementTimeoutMs: 8_000,
    });
    try {
      // Constructing a real pg pool is lazy; inspecting its config opens no connection.
      expect(pool.options).toMatchObject({
        max: 3,
        connectionTimeoutMillis: 2_000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 8_000,
      });
    } finally {
      await pool.end();
    }
  });
});
