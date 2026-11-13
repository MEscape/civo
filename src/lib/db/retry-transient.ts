import { randomInt } from 'node:crypto';

import { SqlQueryError } from '@prisma/orm-family-sql/errors';

import { sleep } from '@lib/utils';

import { causeChain } from './cause-chain';

/** Postgres `serialization_failure` and `deadlock_detected`: the database aborted the transaction and a new attempt can succeed. */
const TRANSIENT_SQLSTATES: readonly string[] = ['40001', '40P01'];

/** How often a transaction is attempted before a transient failure is given up on. */
export const TRANSIENT_ATTEMPTS = 3;

/**
 * The pause before attempt n + 1 is n times this, plus up to this much at random: two transactions
 * that collided must not run again in step and collide again.
 */
export const TRANSIENT_RETRY_DELAY_MS = 25;

function isTransientFailure(thrown: unknown): boolean {
  return causeChain(thrown).some(
    (candidate) =>
      SqlQueryError.is(candidate) &&
      candidate.sqlState !== undefined &&
      TRANSIENT_SQLSTATES.includes(candidate.sqlState),
  );
}

/**
 * Runs a whole transaction again when the database aborted it as a deadlock or serialization
 * failure, up to `TRANSIENT_ATTEMPTS` times, pausing a little longer before each new attempt.
 * `operation` must be the transaction itself, reads and checks included: a retry that reused what
 * the first attempt read would act on stale data. Every other failure, a conflict with another
 * write among them, is permanent and is thrown at once.
 *
 * Only retry an operation whose effects all live inside the aborted transaction: the database
 * undid them, so running them again cannot duplicate anything. A side effect outside it (a mail,
 * a call to another service) would be repeated.
 */
export async function retryTransient<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 1;
  for (;;) {
    try {
      return await operation();
    } catch (thrown) {
      if (attempt >= TRANSIENT_ATTEMPTS || !isTransientFailure(thrown)) {
        throw thrown;
      }
      await sleep(attempt * TRANSIENT_RETRY_DELAY_MS + randomInt(TRANSIENT_RETRY_DELAY_MS));
      attempt += 1;
    }
  }
}
