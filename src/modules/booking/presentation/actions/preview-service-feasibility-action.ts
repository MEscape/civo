'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminQueries } from '../../composition';
import { toServiceFeasibilityDto } from '../dto/setup-dto';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { serviceFeasibilitySchema } from '../schemas/service-feasibility-schema';

import type { ServiceFeasibilityDto } from '../dto/setup-dto';

/** Whether the existing resources can serve a service being configured. Requires `booking.configure`; never cached. */
export async function previewServiceFeasibilityAction(
  input: unknown,
): Promise<ActionResult<ServiceFeasibilityDto>> {
  const result = await parseBookingInput(serviceFeasibilitySchema, input).asyncAndThen((query) =>
    bookingAdminQueries.previewServiceFeasibility.execute(query),
  );
  return toActionResult(result.map(toServiceFeasibilityDto));
}
