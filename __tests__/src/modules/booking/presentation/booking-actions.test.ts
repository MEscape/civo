import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assignEmployeeAction } from '@modules/booking/presentation/actions/assign-employee-action';
import { cancelBookingAction } from '@modules/booking/presentation/actions/cancel-booking-action';
import { claimBookingAction } from '@modules/booking/presentation/actions/claim-booking-action';
import { confirmBookingAction } from '@modules/booking/presentation/actions/confirm-booking-action';
import { createBookingAsStaffAction } from '@modules/booking/presentation/actions/create-booking-as-staff-action';
import { getAvailableSlotsAction } from '@modules/booking/presentation/actions/get-available-slots-action';
import { holdSlotAction } from '@modules/booking/presentation/actions/hold-slot-action';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@modules/booking/composition', () => {
  const useCase = { execute: mocks.execute };
  return {
    getBookingCommands: () => new Proxy({}, { get: () => useCase }),
    getBookingQueries: () => new Proxy({}, { get: () => useCase }),
  };
});

const SEEN = { websiteId: 'site-1', id: 'b-1' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockReturnValue(okAsync(SEEN));
});

describe('what an action accepts', () => {
  it('stops malformed input before any use case runs, with field codes and no prose to translate', async () => {
    const result = await holdSlotAction({ websiteId: '', serviceId: 7, start: 'x'.repeat(500) });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('booking.validation_failed');
      expect(Object.keys(result.error.fieldErrors ?? {}).sort()).toEqual(
        ['locationId', 'serviceId', 'start', 'websiteId'].sort(),
      );
    }
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 'text', 42, []])('refuses %j as a whole request', async (input) => {
    expect((await cancelBookingAction(input)).ok).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('drops every field the action does not name: tenant, role, price, duration, owner', async () => {
    await createBookingAsStaffAction({
      websiteId: 'site-1',
      serviceId: 's-1',
      locationId: 'l-1',
      start: '2027-01-11T10:00:00+01:00',
      customer: { firstName: 'Kim', email: 'kim@example.org', isAdmin: true },
      tenantId: 'someone-elses',
      actorId: 'someone-elses',
      role: 'admin',
      durationMinutes: 1,
      price: 0,
      resourceId: 'r-1',
    });

    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledWith({
      websiteId: 'site-1',
      serviceId: 's-1',
      locationId: 'l-1',
      start: '2027-01-11T10:00:00+01:00',
      customer: { firstName: 'Kim', email: 'kim@example.org' },
    });
  });

  it('sends a target and nothing else for the actions on one booking', async () => {
    await cancelBookingAction({
      websiteId: 'site-1',
      bookingId: 'b-1',
      tenantId: 'x',
      status: 'confirmed',
    });
    await claimBookingAction({
      websiteId: 'site-1',
      bookingId: 'b-1',
      resourceId: 'someone-elses-calendar',
    });

    expect(mocks.execute.mock.calls).toEqual([
      [{ websiteId: 'site-1', bookingId: 'b-1' }],
      [{ websiteId: 'site-1', bookingId: 'b-1' }],
    ]);
  });

  it('cleans the customer the way the rules expect: trimmed, empty fields left out', async () => {
    await confirmBookingAction({
      websiteId: 'site-1',
      bookingId: 'b-1',
      customer: { firstName: '  Kim ', lastName: '', email: ' kim@example.org ', phone: '' },
    });

    expect(mocks.execute).toHaveBeenCalledWith({
      websiteId: 'site-1',
      bookingId: 'b-1',
      customer: { firstName: 'Kim', email: 'kim@example.org' },
    });
  });

  it('refuses an e-mail address that is none, and a requirement index out of range', async () => {
    const mail = await confirmBookingAction({
      websiteId: 'site-1',
      bookingId: 'b-1',
      customer: { email: 'not-an-address' },
    });
    const index = await assignEmployeeAction({
      websiteId: 'site-1',
      bookingId: 'b-1',
      resourceId: 'r-1',
      requirementIndex: -1,
    });

    expect(mail.ok).toBe(false);
    expect(index.ok).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('takes days as calendar days and nothing looser', async () => {
    const base = { websiteId: 'w', serviceId: 's', locationId: 'l' };

    expect(
      (
        await getAvailableSlotsAction({
          ...base,
          from: '2027-01-11',
          to: '2027-01-12',
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await getAvailableSlotsAction({
          ...base,
          from: '11.01.2027',
          to: '2027-01-12',
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await getAvailableSlotsAction({
          ...base,
          from: '2027-01-11',
          to: '2027-01-12T00:00',
        })
      ).ok,
    ).toBe(false);
  });
});

describe('what an action answers', () => {
  it('hands back the use case error as plain data, code and message only', async () => {
    mocks.execute.mockReturnValue(
      errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
    );

    const result = await cancelBookingAction({ websiteId: 'site-1', bookingId: 'b-1' });

    expect(result).toEqual({
      ok: false,
      error: { code: 'auth.permission_denied', message: 'Not allowed.' },
    });
  });

  it('refreshes the admin screens of the website after a change, and only then', async () => {
    await cancelBookingAction({ websiteId: 'site-1', bookingId: 'b-1' });
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith('/bookings/site-1', 'layout');

    mocks.revalidatePath.mockClear();
    mocks.execute.mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'No.')));
    await cancelBookingAction({ websiteId: 'site-1', bookingId: 'b-1' });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('does not refresh anything for a read', async () => {
    mocks.execute.mockReturnValue(
      okAsync({ timeZone: 'Europe/Berlin', slots: [], isTruncated: false }),
    );

    await getAvailableSlotsAction({
      websiteId: 'w',
      serviceId: 's',
      locationId: 'l',
      from: '2027-01-11',
      to: '2027-01-11',
    });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
