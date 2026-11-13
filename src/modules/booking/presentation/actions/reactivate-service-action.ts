'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { reactivateServiceSchema } from '../schemas/service-schema';

import type { ServiceDto } from '../dto/service-dto';

/**
 * A manager switches a service on again. A thin adapter: it validates the request, hands it to the
 * use case, which authorizes and applies every rule, and returns the typed result with stable error
 * codes, never a message.
 */
export async function reactivateServiceAction(input: unknown): Promise<ActionResult<ServiceDto>> {
  const result = await parseBookingInput(reactivateServiceSchema, input).asyncAndThen((command) =>
    getBookingCommands().reactivateService.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
