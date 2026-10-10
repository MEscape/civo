'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toServiceDto } from '../dto/setup-dto';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { serviceConfigSchema } from '../schemas/service-config-schema';

import type { ServiceDto } from '../dto/setup-dto';

/** Creates a service, or replaces the one named by `id`. Requires `booking.configure`. */
export async function saveServiceAction(input: unknown): Promise<ActionResult<ServiceDto>> {
  const result = await parseBookingInput(serviceConfigSchema, input).asyncAndThen(
    ({ id, ...config }) =>
      id === undefined
        ? bookingAdminCommands.createBookableService.execute(config)
        : bookingAdminCommands.updateBookableService.execute({ ...config, id }),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result.map(toServiceDto));
}
