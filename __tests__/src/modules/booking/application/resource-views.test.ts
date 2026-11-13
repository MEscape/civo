import { describe, expect, it } from 'vitest';

import {
  toResourceSummary,
  toResourceView,
} from '@modules/booking/application/services/resource-views';
import type { ResourceContext } from '@modules/booking/application/services/resource-views';
import { toBookableResourceId, toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { StoredLocation } from '@modules/booking/domain/ports/location-admin.repository';
import type { StoredResource } from '@modules/booking/domain/ports/resource-admin.repository';
import { CLOSED_DAY } from '@modules/booking/domain/scheduling/weekly-hours';
import type { WeeklyHours } from '@modules/booking/domain/scheduling/weekly-hours';
import { asInstant } from '@modules/booking/domain/time/instant';

import { NOW, makeBooking, minutes } from '../support/booking-fixtures';

describe('resource-views application service', () => {
  const defaultDay = {
    ranges: [{ startMinute: 480, endMinute: 1020 }],
    breaks: [{ startMinute: 720, endMinute: 780 }],
  };

  const weekly: WeeklyHours = {
    1: defaultDay,
    2: defaultDay,
    3: defaultDay,
    4: defaultDay,
    5: defaultDay,
    6: CLOSED_DAY,
    7: CLOSED_DAY,
  };

  const location: StoredLocation = {
    address: null,
    id: toBookingLocationId('loc-1'),
    name: 'City Office',
    zone: 'Europe/Berlin' as any,
    openingHours: { weekly, exceptions: [] },
    isActive: true,
    updatedAt: NOW,
  };

  const storedResource: StoredResource = {
    id: toBookableResourceId('res-1'),
    name: 'Consultation Room A',
    type: 'room',
    capacity: 2,
    locationId: location.id,
    isActive: true,
    setupMinutes: minutes(10),
    teardownMinutes: minutes(15),
    internalNote: 'Internal note here',
    availability: null,
    updatedAt: NOW,
  };

  const context: ResourceContext = {
    isUsersTruncated: false,
    location,
    today: [
      makeBooking({
        assignments: [
          {
            requirementIndex: 0,
            resourceType: 'room',
            resourceId: storedResource.id,
            occupied: { start: NOW, end: asInstant(NOW + 1800000) },
          },
        ],
      }),
    ],
    users: [
      {
        resourceId: storedResource.id,
        serviceId: 'svc-1' as any,
        serviceName: 'Passport Renewal',
        isRequired: true,
      },
      {
        resourceId: toBookableResourceId('res-other'),
        serviceId: 'svc-2' as any,
        serviceName: 'ID Card',
        isRequired: false,
      },
    ],
    now: NOW,
  };

  it('generates resource summary with status and today usage', () => {
    const summary = toResourceSummary(storedResource, context);

    expect(summary.id).toBe(storedResource.id);
    expect(summary.name).toBe(storedResource.name);
    expect(summary.type).toBe('room');
    expect(summary.places).toBe(2);
    expect(summary.status).toBe('active');
    expect(summary.usedBy).toEqual([
      { serviceId: 'svc-1', serviceName: 'Passport Renewal', isRequired: true },
    ]);
    expect(summary.today.timeZone).toBe('Europe/Berlin');
    expect(summary.today.busy).toHaveLength(1);
    expect(summary.today.busy[0]?.isFull).toBe(false); // capacity is 2, 1 booking -> not full
    expect(summary.today.peak).toBe(1);
  });

  it('reports inactive status when resource is not active', () => {
    const inactive = { ...storedResource, isActive: false };
    const summary = toResourceSummary(inactive, context);
    expect(summary.status).toBe('inactive');
  });

  it('generates full resource view for editing', () => {
    const view = toResourceView(storedResource, {
      ...context,
      websiteId: 'website-123',
    });

    expect(view.websiteId).toBe('website-123');
    expect(view.location).toEqual({ id: location.id, name: location.name });
    expect(view.setupMinutes).toBe(10);
    expect(view.teardownMinutes).toBe(15);
    expect(view.internalNote).toBe('Internal note here');
    expect(view.followsLocation).toBe(true);
    expect(view.weekly).toHaveLength(7);
    expect(view.locationWeekly).toHaveLength(7);
    expect(view.blocks).toHaveLength(0);
    expect(typeof view.version).toBe('string');
  });
});
