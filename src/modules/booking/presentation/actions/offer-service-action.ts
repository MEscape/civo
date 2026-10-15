'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toServiceDto } from '../dto/setup-dto';
import { offerServiceSchema } from '../schemas/offer-service-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { ServiceDto } from '../dto/setup-dto';

/** Offers an existing service at a location, or stops offering it there. Requires `booking.configure`. */
export async function offerServiceAction(input: unknown): Promise<ActionResult<ServiceDto>> {
  const result = await parseBookingInput(offerServiceSchema, input).asyncAndThen(
    ({ websiteId: _websiteId, ...change }) =>
      bookingAdminCommands.offerServiceAtLocation.execute(change),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result.map(toServiceDto));
}
