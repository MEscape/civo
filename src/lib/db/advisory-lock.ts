import { db } from './client';

/** The handle `db.transaction` passes to its callback: what every write in a transaction runs on. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Takes a transaction-scoped PostgreSQL advisory lock on `key`, held until the transaction ends.
 * Writers that must not interleave agree on a key and queue behind each other. The key is hashed
 * to 64 bits (`hashtextextended`): with 32 bits, two unrelated keys would share a lock often enough
 * to make unrelated writers wait for each other.
 */
export async function advisoryLock(tx: Transaction, key: string): Promise<void> {
  const plan = db.raw.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`
    .returnsRow({ locked: { codecId: 'pg/text@1', nullable: true } })
    .build();
  await tx.query(plan);
}
