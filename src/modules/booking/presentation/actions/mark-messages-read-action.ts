'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { markMessagesReadSchema } from '../schemas/employee-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { MarkedReadDto } from '../dto/employee-dto';

/**
 * The signed-in member marks one message, or all of them, read. A thin adapter: it validates the
 * request, hands it to the use case, which authorizes, and returns how many were marked.
 */
export async function markMessagesReadAction(input: unknown): Promise<ActionResult<MarkedReadDto>> {
  const result = await parseBookingInput(markMessagesReadSchema, input).asyncAndThen((command) =>
    getBookingCommands().markMessagesRead.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
