/**
 * Integration test, against a real Postgres, of what the persistence helpers read from real driver
 * errors: the constraint a conflicting write ran into, and a deadlock that the database really
 * detected and that a retry gets past. (The unit test fakes the driver's predicates; this one
 * proves they match what the driver throws.) Needs the database of `DATABASE_URL` with the
 * migrations applied: `npm run test:integration`.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { conflictConstraint, db, disconnectDb, retryTransient } from '@lib/db';

const suffix = Math.random().toString(36).slice(2, 10);

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lock(tx: Transaction, key: string): Promise<void> {
  const plan = db.raw.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`
    .returnsRow({ locked: { codecId: 'pg/text@1', nullable: true } })
    .build();
  await tx.query(plan);
}

describe('persistence failures read from a real driver (real Postgres)', () => {
  afterAll(async () => {
    await db.orm.public.Website.where({ id: `it-failures-${suffix}` }).deleteAndCount();
    await disconnectDb();
  });

  it('names the constraint a unique violation ran into', async () => {
    const site = (id: string) =>
      db.orm.public.Website.create({
        id,
        tenantId: id,
        name: id,
        slug: `it-failures-${suffix}`,
        templateKey: 'civic',
      });
    await site(`it-failures-${suffix}`);

    const thrown = await site(`it-failures-${suffix}-again`).catch((error: unknown) => error);

    expect(conflictConstraint(thrown)).toBe('Website_slug_key');
    expect(conflictConstraint(new Error('not from the driver'))).toBeUndefined();
  });

  it('gets two transactions that deadlock past it: the one the database aborts runs again', async () => {
    const first = `it-deadlock-a-${suffix}`;
    const second = `it-deadlock-b-${suffix}`;
    let holding = 0;
    let release: () => void = () => undefined;
    const bothHold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const attempts = { a: 0, b: 0 };

    const run = (name: 'a' | 'b', own: string, other: string) =>
      retryTransient(() =>
        db.transaction(async (tx) => {
          attempts[name] += 1;
          await lock(tx, own);
          if (attempts[name] === 1) {
            // Each holds its own lock and only then asks for the other's: a deadlock by construction.
            holding += 1;
            if (holding === 2) {
              release();
            }
            await bothHold;
          }
          await lock(tx, other);
        }),
      );

    await Promise.all([run('a', first, second), run('b', second, first)]);

    expect(attempts.a + attempts.b).toBe(3);
  }, 30_000);
});
