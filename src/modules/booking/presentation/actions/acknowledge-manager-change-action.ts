'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { acknowledgeManagerChangeSchema } from '../schemas/acknowledge-manager-change-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

/** The employee has seen what a manager changed on their calendar. Requires `booking.profile.own`. */
export async function acknowledgeManagerChangeAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = parseBookingInput(acknowledgeManagerChangeSchema, input);
  const result = await parsed.asyncAndThen(({ websiteId }) =>
    bookingAdminCommands.acknowledgeManagerChange.execute(websiteId).map(() => null),
  );
  if (result.isOk() && parsed.isOk()) {
    invalidateBookingAdmin(parsed.value.websiteId);
  }
  return toActionResult(result);
}
