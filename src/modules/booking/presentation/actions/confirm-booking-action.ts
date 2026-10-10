'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingFlowCommands } from '../../composition';
import { toBookingDto } from '../dto/booking-dto';
import { withinRequestBudget } from '../guards/limit-public-request';
import { confirmBookingSchema } from '../schemas/confirm-booking-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { BookingDto } from '../dto/booking-dto';

/** Turns a hold into a booking once the visitor's details are in. Safe to repeat. */
export async function confirmBookingAction(input: unknown): Promise<ActionResult<BookingDto>> {
  const result = await parseBookingInput(confirmBookingSchema, input)
    .asyncAndThen(withinRequestBudget('confirm'))
    .andThen((request) => bookingFlowCommands.confirmBooking.execute(request));
  return toActionResult(result.map(toBookingDto));
}
