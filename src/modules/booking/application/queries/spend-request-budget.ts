import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { rateLimited } from '../../domain/errors/booking-errors';

import type { LimitedAction } from '../../domain/ports/request-limiter.port';
import type { RequestBudgetDependencies } from '../booking-dependencies';

export interface SpendRequestBudgetInput {
  /** Who is counted: the website and the visitor's address, never anything the visitor typed. */
  readonly key: string;
  readonly action: LimitedAction;
}

/**
 * Spends one request of a visitor's budget for an action. Refuses with
 * `booking.rate_limited` once the budget is gone, so a script cannot probe
 * references or hoard holds. The budget is per server process.
 *
 * @authorization public Runs before any visitor is identified; it only counts requests.
 */
export class SpendRequestBudget {
  constructor(private readonly deps: RequestBudgetDependencies) {}

  execute(input: SpendRequestBudgetInput): AppResult<true, ConflictAppError> {
    return this.deps.limiter.allow(input.key, input.action, this.deps.clock.now())
      ? ok(true)
      : err(rateLimited());
  }
}
