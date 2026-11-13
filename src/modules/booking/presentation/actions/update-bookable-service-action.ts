'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { updateServiceSchema } from '../schemas/service-schema';

import type { ServiceDto } from '../dto/service-dto';

/**
 * A manager changes a service at a location, from the versions they read. A thin adapter: it
 * validates the request, hands it to the use case, which authorizes and applies every rule, and
 * returns the typed result with stable error codes, never a message.
 */
export async function updateBookableServiceAction(
  input: unknown,
): Promise<ActionResult<ServiceDto>> {
  const result = await parseBookingInput(updateServiceSchema, input).asyncAndThen((command) =>
    getBookingCommands().updateBookableService.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
