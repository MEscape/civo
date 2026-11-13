import { describe, expect, it, vi } from 'vitest';

import { advisoryLock } from '@lib/db/advisory-lock';
import type { Transaction } from '@lib/db/advisory-lock';

vi.mock('@lib/db/client', () => ({
  db: {
    raw: {
      sql: (_strings: TemplateStringsArray, key: string) => ({
        returnsRow: () => ({
          build: () => ({
            sql: `SELECT pg_advisory_xact_lock(hashtextextended('${key}', 0))::text AS locked`,
          }),
        }),
      }),
    },
  },
}));

describe('advisoryLock', () => {
  it('executes the pg_advisory_xact_lock plan on the transaction', async () => {
    const mockQuery = vi.fn().mockResolvedValue([{ locked: null }]);
    const mockTx = { query: mockQuery } as unknown as Transaction;

    await advisoryLock(mockTx, 'membership:site-123');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('SELECT pg_advisory_xact_lock'),
      }),
    );
  });
});
