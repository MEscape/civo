import { ConfirmBooking } from '@modules/booking/application/commands/confirm-booking';
import { HoldSlot } from '@modules/booking/application/commands/hold-slot';
import type { HoldView } from '@modules/booking/application/contracts/booking-views';

import { LOCATION_ID, SERVICE_ID, WEBSITE, at } from './fixtures';

import type { World } from './world';

export const iso = (epoch: number): string => new Date(epoch).toISOString();
export const TUESDAY_10 = iso(at('2027-01-05', '10:00'));
export const customer = (email = 'ada@example.org') => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email,
});

export function hold(world: World, start = TUESDAY_10, participants = 1) {
  return new HoldSlot(world.flow).execute({
    websiteId: WEBSITE,
    serviceId: SERVICE_ID,
    locationId: LOCATION_ID,
    start,
    participants,
  });
}

export function confirm(
  world: World,
  holdId: string,
  who: Readonly<Record<string, string>> = customer(),
) {
  return new ConfirmBooking(world.flow).execute({
    websiteId: WEBSITE,
    holdId,
    customer: who,
  });
}

export async function book(world: World, start = TUESDAY_10, email = 'ada@example.org') {
  const held: HoldView = (await hold(world, start))._unsafeUnwrap();
  return (await confirm(world, held.holdId, customer(email)))._unsafeUnwrap();
}
