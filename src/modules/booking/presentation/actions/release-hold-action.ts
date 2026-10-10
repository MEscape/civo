'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingFlowCommands } from '../../composition';
import { withinRequestBudget } from '../guards/limit-public-request';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { releaseHoldSchema } from '../schemas/release-hold-schema';

/** Gives the time back when the visitor leaves the form; the hold would lapse on its own anyway. */
export async function releaseHoldAction(input: unknown): Promise<ActionResult<{ released: true }>> {
  const result = await parseBookingInput(releaseHoldSchema, input)
    .asyncAndThen(withinRequestBudget('change'))
    .andThen((request) => bookingFlowCommands.releaseHold.execute(request));
  return toActionResult(result.map(() => ({ released: true as const })));
}
