'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingFlowCommands } from '../../composition';
import { toHoldDto } from '../dto/booking-dto';
import { withinRequestBudget } from '../guards/limit-public-request';
import { holdSlotSchema } from '../schemas/hold-slot-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { HoldDto } from '../dto/booking-dto';

/** Reserves the chosen time for a few minutes while the visitor fills in the form. */
export async function holdSlotAction(input: unknown): Promise<ActionResult<HoldDto>> {
  const result = await parseBookingInput(holdSlotSchema, input)
    .asyncAndThen(withinRequestBudget('hold'))
    .andThen((request) => bookingFlowCommands.holdSlot.execute(request));
  return toActionResult(result.map(toHoldDto));
}
