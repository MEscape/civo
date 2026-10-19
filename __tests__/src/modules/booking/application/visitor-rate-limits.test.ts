import { describe, expect, it } from 'vitest';

import { HoldSlot } from '@modules/booking/application/commands/hold-slot';
import { GetAvailableSlots } from '@modules/booking/application/queries/get-available-slots';
import { GetPublicBooking } from '@modules/booking/application/queries/get-public-booking';
import { BOOKING_RATE_LIMITS } from '@modules/booking/application/rate-limits';
import { BOOKING_ERROR_CODES } from '@modules/booking/domain/errors/booking-errors';

import {
  UNRESOLVED_CLIENT,
  clientAt,
  createBrokenRateLimiter,
} from '../../../support/rate-limiting';
import { LOCATION_ID, SERVICE_ID, WEBSITE } from '../support/fixtures';
import { TUESDAY_10 } from '../support/flow-helpers';
import { createWorld } from '../support/world';

const slotsQuery = {
  websiteId: WEBSITE,
  serviceId: SERVICE_ID,
  locationId: LOCATION_ID,
  from: '2027-01-05',
  to: '2027-01-05',
  participants: 1,
};

const lookup = { websiteId: WEBSITE, reference: 'BK-UNKNOWN', email: 'nobody@example.org' };

describe('what a visitor may repeat on the public booking pages', () => {
  it('refuses a lookup once the visitor has used up the budget, and says when to retry', async () => {
    const world = createWorld();
    const useCase = new GetPublicBooking(world.flow);

    const outcomes = [];
    for (let attempt = 0; attempt <= BOOKING_RATE_LIMITS.lookupClient.limit; attempt += 1) {
      outcomes.push(await useCase.execute(lookup));
    }

    const refused = outcomes.at(-1)?._unsafeUnwrapErr();
    expect(refused).toMatchObject({ kind: 'rate_limited', code: BOOKING_ERROR_CODES.rateLimited });
    expect(refused?.kind === 'rate_limited' && refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(outcomes.slice(0, -1).every((outcome) => outcome.isErr())).toBe(true);
    expect(outcomes.slice(0, -1).map((outcome) => outcome._unsafeUnwrapErr().kind)).not.toContain(
      'rate_limited',
    );
  });

  it('counts each visitor apart, so one flood does not turn others away', async () => {
    const world = createWorld();
    const flooder = new GetPublicBooking(world.flow);
    const bystander = new GetPublicBooking({
      ...world.flow,
      clientAddress: clientAt('198.51.100.9'),
    });
    for (let attempt = 0; attempt <= BOOKING_RATE_LIMITS.lookupClient.limit; attempt += 1) {
      await flooder.execute(lookup);
    }

    expect((await bystander.execute(lookup))._unsafeUnwrapErr().kind).not.toBe('rate_limited');
  });

  it('shares one search budget between availability and alternatives, per visitor', async () => {
    const world = createWorld();
    const useCase = new GetAvailableSlots(world.flow);

    for (let attempt = 0; attempt < BOOKING_RATE_LIMITS.searchClient.limit; attempt += 1) {
      await useCase.execute(slotsQuery);
    }

    expect((await useCase.execute(slotsQuery))._unsafeUnwrapErr().kind).toBe('rate_limited');
  });

  it('does not refuse anyone when the visitor address cannot be determined', async () => {
    const world = createWorld();
    const useCase = new GetPublicBooking({ ...world.flow, clientAddress: UNRESOLVED_CLIENT });

    const outcomes = [];
    for (let attempt = 0; attempt <= BOOKING_RATE_LIMITS.lookupClient.limit; attempt += 1) {
      outcomes.push(await useCase.execute(lookup));
    }

    expect(outcomes.map((outcome) => outcome._unsafeUnwrapErr().kind)).not.toContain(
      'rate_limited',
    );
  });

  it('keeps availability and holds working when the limiter is down', async () => {
    const world = createWorld();
    const flow = { ...world.flow, rateLimiter: createBrokenRateLimiter() };

    const slots = await new GetAvailableSlots(flow).execute(slotsQuery);
    const held = await new HoldSlot(flow).execute({
      websiteId: WEBSITE,
      serviceId: SERVICE_ID,
      locationId: LOCATION_ID,
      start: TUESDAY_10,
      participants: 1,
    });

    expect(slots.isOk()).toBe(true);
    expect(held.isOk()).toBe(true);
  });

  it('refuses a lookup, as an infrastructure failure, when the limiter is down', async () => {
    const world = createWorld();
    const useCase = new GetPublicBooking({ ...world.flow, rateLimiter: createBrokenRateLimiter() });

    const result = await useCase.execute(lookup);

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'infrastructure',
      code: BOOKING_ERROR_CODES.rateLimiterFailed,
    });
  });
});
