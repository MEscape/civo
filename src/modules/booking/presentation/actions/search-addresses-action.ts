'use server';

import { getLocale } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminQueries } from '../../composition';
import { toAddressSuggestionDto } from '../dto/setup-dto';
import { addressSearchSchema } from '../schemas/address-search-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { AddressSuggestionDto } from '../dto/setup-dto';

/**
 * Address suggestions for what the editor has typed. Requires
 * `booking.configure`, is limited per person, and never cached by the browser.
 * The language follows the request, so a German editor gets German street names.
 */
export async function searchAddressesAction(
  input: unknown,
): Promise<ActionResult<readonly AddressSuggestionDto[]>> {
  const language = await getLocale();
  const result = await parseBookingInput(addressSearchSchema, {
    ...(typeof input === 'object' && input !== null ? input : {}),
    language,
  }).asyncAndThen((query) => bookingAdminQueries.searchAddresses.execute(query));
  return toActionResult(result.map((suggestions) => suggestions.map(toAddressSuggestionDto)));
}
