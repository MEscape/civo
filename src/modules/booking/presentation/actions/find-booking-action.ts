'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingPublicQueries } from '../../composition';
import { toBookingDto } from '../dto/booking-dto';
import { withinRequestBudget } from '../guards/limit-public-request';
import { bookingAccessSchema } from '../schemas/booking-access-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { BookingDto } from '../dto/booking-dto';

/**
 * A visitor looks up their own booking by reference AND e-mail address. A
 * wrong address answers exactly like an unknown reference.
 */
export async function findBookingAction(input: unknown): Promise<ActionResult<BookingDto>> {
  const result = await parseBookingInput(bookingAccessSchema, input)
    .asyncAndThen(withinRequestBudget('lookup'))
    .andThen((request) => bookingPublicQueries.getPublicBooking.execute(request));
  return toActionResult(result.map(toBookingDto));
}
