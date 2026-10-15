'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { deleteEntitySchema } from '../schemas/delete-entity-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

/** Removes a resource that nothing refers to. Requires `booking.configure`. */
export async function deleteResourceAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = parseBookingInput(deleteEntitySchema, input);
  const result = await parsed.asyncAndThen(({ id }) =>
    bookingAdminCommands.deleteBookableResource.execute(id).map(() => null),
  );
  if (result.isOk() && parsed.isOk()) {
    invalidateBookingAdmin(parsed.value.websiteId);
  }
  return toActionResult(result);
}
