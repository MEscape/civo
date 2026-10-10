'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toLocationDto } from '../dto/setup-dto';
import { locationConfigSchema } from '../schemas/location-config-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { LocationDto } from '../dto/setup-dto';

/** Creates a location, or replaces the one named by `id`. Requires `booking.configure`. */
export async function saveLocationAction(input: unknown): Promise<ActionResult<LocationDto>> {
  const result = await parseBookingInput(locationConfigSchema, input).asyncAndThen(
    ({ id, ...config }) =>
      id === undefined
        ? bookingAdminCommands.createBookingLocation.execute(config)
        : bookingAdminCommands.updateBookingLocation.execute({ ...config, id }),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result.map(toLocationDto));
}
