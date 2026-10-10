'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingPublicQueries } from '../../composition';
import { toAlternativeSlotsDto } from '../dto/availability-dto';
import { withinRequestBudget } from '../guards/limit-public-request';
import { holdSlotSchema } from '../schemas/hold-slot-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { AlternativeSlotsDto } from '../dto/availability-dto';

/** The nearest free times around one that was just taken, in a fixed deterministic order. */
export async function suggestAlternativeSlotsAction(
  input: unknown,
): Promise<ActionResult<AlternativeSlotsDto>> {
  const result = await parseBookingInput(holdSlotSchema, input)
    .asyncAndThen(withinRequestBudget('search'))
    .andThen((query) => bookingPublicQueries.suggestAlternativeSlots.execute(query));
  return toActionResult(result.map(toAlternativeSlotsDto));
}
