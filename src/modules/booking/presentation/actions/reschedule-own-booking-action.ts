'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingFlowCommands } from '../../composition';
import { toBookingDto } from '../dto/booking-dto';
import { withinRequestBudget } from '../guards/limit-public-request';
import { rescheduleOwnBookingSchema } from '../schemas/booking-access-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { BookingDto } from '../dto/booking-dto';

export async function rescheduleOwnBookingAction(
  input: unknown,
): Promise<ActionResult<BookingDto>> {
  const result = await parseBookingInput(rescheduleOwnBookingSchema, input)
    .asyncAndThen(withinRequestBudget('change'))
    .andThen((request) => bookingFlowCommands.rescheduleOwnBooking.execute(request));
  return toActionResult(result.map(toBookingDto));
}
