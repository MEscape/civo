'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingPublicQueries } from '../../composition';
import { toAvailabilityDto } from '../dto/availability-dto';
import { withinRequestBudget } from '../guards/limit-public-request';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { slotsQuerySchema } from '../schemas/slots-query-schema';

import type { AvailabilityDto } from '../dto/availability-dto';

/** Bookable start times for a service at a location over a short range of days. Never cached. */
export async function getAvailableSlotsAction(
  input: unknown,
): Promise<ActionResult<AvailabilityDto>> {
  const result = await parseBookingInput(slotsQuerySchema, input)
    .asyncAndThen(withinRequestBudget('search'))
    .andThen((query) => bookingPublicQueries.getAvailableSlots.execute(query));
  return toActionResult(result.map(toAvailabilityDto));
}
