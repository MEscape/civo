'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { updateResourceSchema } from '../schemas/resource-schema';

import type { ResourceDto } from '../dto/resource-dto';

/**
 * A manager changes a resource, from the version they read. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function updateBookableResourceAction(
  input: unknown,
): Promise<ActionResult<ResourceDto>> {
  const result = await parseBookingInput(updateResourceSchema, input).asyncAndThen((command) =>
    getBookingCommands().updateBookableResource.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
