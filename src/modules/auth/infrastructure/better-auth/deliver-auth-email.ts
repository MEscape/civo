import { after } from 'next/server';

import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import type { AppResultAsync } from '@lib/result';

import { mailDeliveryFailed } from '../../domain/errors/auth-errors';

import type { AuthEmailKind } from '../mail/auth-email-templates';

const mailLogger = logger.withContext({ module: 'auth.mail' });

/**
 * Schedules one provider email after the response and reports delivery failure exactly once.
 * Delivery errors never escape the task: for password-reset and sign-up the response must be identical
 * whether or not the address exists, and a delivery error that surfaced
 * only for real accounts would reintroduce the enumeration oracle.
 *
 * Only stable failure fields are logged. The message itself carries a single-use link.
 */
export function deliverAuthEmail(
  send: () => AppResultAsync<void, InfrastructureAppError>,
  kind: AuthEmailKind,
): Promise<void> {
  // Defer starting the transport as well as awaiting it: account existence must not affect response timing.
  after(async () => {
    let failure = mailDeliveryFailed(undefined);
    try {
      const result = await send();
      if (result.isOk()) {
        return;
      }
      failure = result.error;
    } catch {
      // Rendering or transport code may throw before producing a typed failure. Never expose it to the caller.
    }
    // Transport messages and causes can contain addresses or single-use links. Log only our stable failure code.
    mailLogger.error(
      'auth.email_delivery_failed',
      { kind: failure.kind, code: failure.code },
      { kind },
    );
  });
  return Promise.resolve();
}
