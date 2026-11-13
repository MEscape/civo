import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markMessagesReadAction } from '@modules/booking/presentation/actions/mark-messages-read-action';
import { saveEmployeePreferencesAction } from '@modules/booking/presentation/actions/save-employee-preferences-action';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn(), execute: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@modules/booking/composition', () => {
  const useCase = { execute: mocks.execute };
  return {
    getBookingCommands: () => new Proxy({}, { get: () => useCase }),
    getBookingQueries: () => new Proxy({}, { get: () => useCase }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the employee area’s actions', () => {
  it('stop a malformed preferences request before the use case, with field codes', async () => {
    const result = await saveEmployeePreferencesAction({
      websiteId: 'site-1',
      serviceIds: 'all',
      window: { startMinute: 600, endMinute: 540 },
      tenantId: 'someone-else',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('booking.validation_failed');
      expect(Object.keys(result.error.fieldErrors ?? {}).sort()).toEqual(
        ['serviceIds', 'window.endMinute'].sort(),
      );
    }
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('hand a valid request on without anything a client may not name, and refresh after success', async () => {
    mocks.execute.mockReturnValue(okAsync({ websiteId: 'site-1', serviceIds: [], window: null }));

    const result = await saveEmployeePreferencesAction({
      websiteId: 'site-1',
      serviceIds: [],
      window: null,
      resourceId: 'someone-elses-calendar',
    });

    expect(result.ok).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith({
      websiteId: 'site-1',
      serviceIds: [],
      window: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/bookings/site-1', 'layout');
  });

  it('mark read with one id or none, pass a refusal on as its code, and refresh nothing then', async () => {
    expect((await markMessagesReadAction({ websiteId: 'site-1', messageId: 5 })).ok).toBe(false);

    mocks.execute.mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'No.')));
    const refused = await markMessagesReadAction({ websiteId: 'site-1', messageId: null });

    expect(refused).toMatchObject({ ok: false, error: { code: 'auth.permission_denied' } });
    expect(mocks.execute).toHaveBeenCalledWith({ websiteId: 'site-1', messageId: null });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
