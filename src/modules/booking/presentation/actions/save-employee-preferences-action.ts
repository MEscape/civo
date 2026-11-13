'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { savePreferencesSchema } from '../schemas/employee-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { SavedPreferencesDto } from '../dto/employee-dto';

/**
 * The signed-in employee saves where, what and when they would like to work. A thin adapter: it
 * validates the request, hands it to the use case, which authorizes and applies every rule, and
 * returns the typed result with stable error codes, never a message.
 */
export async function saveEmployeePreferencesAction(
  input: unknown,
): Promise<ActionResult<SavedPreferencesDto>> {
  const result = await parseBookingInput(savePreferencesSchema, input).asyncAndThen((command) =>
    getBookingCommands().saveEmployeePreferences.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
