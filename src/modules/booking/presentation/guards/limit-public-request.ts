import { headers } from 'next/headers';

import type { ConflictAppError } from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResult } from '@lib/result';

import { bookingRequestCommands } from '../../composition';

import type { LimitedAction } from '../../application/contracts/booking-constraints';

const FALLBACK_ADDRESS = 'unknown';

/**
 * The visitor's address as the platform reports it. A proxy puts the original
 * client first in `x-forwarded-for`; without one the visitors share a
 * bucket, which is the safe direction for a limiter.
 */
async function visitorAddress(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first === undefined || first === '' ? FALLBACK_ADDRESS : first;
}

/**
 * Spends one request of the visitor's budget for `action` on this website.
 * The key holds only the website and the address; nothing the visitor typed.
 */
export async function limitPublicRequest(
  action: LimitedAction,
  websiteId: string,
): Promise<AppResult<true, ConflictAppError>> {
  const address = await visitorAddress();
  return bookingRequestCommands.spendRequestBudget.execute({
    key: `${websiteId}:${address}`,
    action,
  });
}

/**
 * `limitPublicRequest` as a step of an action's pipeline: passes the validated
 * request on when the visitor still has budget, and stops there when not.
 */
export function withinRequestBudget(
  action: LimitedAction,
): <TRequest extends { readonly websiteId: string }>(
  request: TRequest,
) => ResultAsync<TRequest, ConflictAppError> {
  return (request) =>
    new ResultAsync(
      limitPublicRequest(action, request.websiteId).then((allowed) => allowed.map(() => request)),
    );
}
