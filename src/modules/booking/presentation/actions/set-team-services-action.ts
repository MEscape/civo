'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toResourceDto } from '../dto/setup-dto';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { teamServicesSchema } from '../schemas/team-services-schema';

import type { ResourceDto } from '../dto/setup-dto';

/** Sets the services one employee offers. Requires `booking.manage`. */
export async function setTeamServicesAction(input: unknown): Promise<ActionResult<ResourceDto>> {
  const result = await parseBookingInput(teamServicesSchema, input).asyncAndThen(
    ({ websiteId, ...change }) =>
      bookingAdminCommands.setTeamMemberServices
        .execute(change)
        .map((resource) => ({ websiteId, resource })),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result.map(({ resource }) => toResourceDto(resource)));
}
