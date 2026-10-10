'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toResourceDto } from '../dto/setup-dto';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { resourceConfigSchema } from '../schemas/resource-config-schema';

import type { ResourceDto } from '../dto/setup-dto';

/** Creates a resource, or replaces the one named by `id`. Requires `booking.configure`. */
export async function saveResourceAction(input: unknown): Promise<ActionResult<ResourceDto>> {
  const result = await parseBookingInput(resourceConfigSchema, input).asyncAndThen(
    ({ id, ...config }) =>
      id === undefined
        ? bookingAdminCommands.createBookableResource.execute(config)
        : bookingAdminCommands.updateBookableResource.execute({ ...config, id }),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result.map(toResourceDto));
}
