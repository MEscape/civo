import { describe, expect, it } from 'vitest';

import type {
  AvailabilityView,
  BookingView,
  HoldView,
  PublicCatalogView,
} from '@modules/booking/application/contracts/booking-views';
import {
  toAlternativeSlotsDto,
  toAvailabilityDto,
  toSlotDto,
} from '@modules/booking/presentation/dto/availability-dto';
import { toBookingDto, toHoldDto } from '@modules/booking/presentation/dto/booking-dto';
import { toPublicCatalogDto } from '@modules/booking/presentation/dto/catalog-dto';

describe('slot DTOs', () => {
  const view = {
    start: new Date('2026-10-12T08:00:00.000Z'),
    end: new Date('2026-10-12T08:20:00.000Z'),
    remainingParticipants: 3,
  };

  it('labels the slot with the wall clock at the location', () => {
    expect(toSlotDto(view as never, 'Europe/Berlin')).toEqual({
      start: '2026-10-12T08:00:00.000Z',
      end: '2026-10-12T08:20:00.000Z',
      localDate: '2026-10-12',
      localTime: '10:00',
      remainingParticipants: 3,
    });
  });

  it('keeps the same instant but a different label for another zone', () => {
    const berlin = toSlotDto(view, 'Europe/Berlin');
    const tokyo = toSlotDto(view, 'Asia/Tokyo');
    expect(tokyo.start).toBe(berlin.start);
    expect(tokyo.localTime).toBe('17:00');
  });

  it('serialises only plain data', () => {
    const availability: AvailabilityView = {
      serviceId: 's',
      locationId: 'l',
      timeZone: 'Europe/Berlin',
      from: '2026-10-12',
      to: '2026-10-13',
      slots: [view],
    };
    const dto = toAvailabilityDto(availability);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    expect(dto.slots[0]?.localTime).toBe('10:00');

    const alternatives = toAlternativeSlotsDto({
      timeZone: 'Europe/Berlin',
      slots: [view],
    });
    expect(alternatives.slots).toHaveLength(1);
  });
});

describe('booking DTOs', () => {
  it('does not carry anything beyond what the visitor needs', () => {
    const hold = toHoldDto({
      holdId: 'h',
      expiresAt: new Date('2026-10-12T07:55:00Z'),
      start: new Date('2026-10-12T08:00:00Z'),
      end: new Date('2026-10-12T08:20:00Z'),
      participants: 1,
      timeZone: 'Europe/Berlin',
      serviceName: 'Passport',
      locationName: 'Town hall',
      // Extra fields a view might grow later must not leak.
      tenantId: 'secret-tenant',
      resourceIds: ['r1'],
    } as unknown as HoldView);
    expect(Object.keys(hold).sort()).toEqual([
      'end',
      'expiresAt',
      'holdId',
      'localDate',
      'localTime',
      'locationName',
      'participants',
      'serviceName',
      'start',
      'timeZone',
    ]);
  });

  it('never exposes tenant or resource information on a booking', () => {
    const dto = toBookingDto({
      reference: 'BK-1',
      status: 'confirmed',
      serviceId: 's',
      serviceName: 'Passport',
      locationId: 'l',
      locationName: 'Town hall',
      locationAddress: null,
      timeZone: 'Europe/Berlin',
      start: new Date('2026-10-12T08:00:00Z'),
      end: new Date('2026-10-12T08:20:00Z'),
      participants: 1,
      firstName: 'Ada',
      lastName: 'L',
      email: 'ada@example.org',
      requiredDocuments: [],
      instructions: null,
      canCancel: true,
      canReschedule: false,
      rescheduleCount: 0,
      tenantId: 'secret-tenant',
      resourceIds: ['r1'],
      internalNotes: 'staff only',
    } as unknown as BookingView);
    const text = JSON.stringify(dto);
    expect(text).not.toContain('secret-tenant');
    expect(text).not.toContain('r1');
    expect(text).not.toContain('staff only');
    expect(dto.localTime).toBe('10:00');
  });

  it('keeps only the catalog fields visitors may see', () => {
    const dto = toPublicCatalogDto({
      services: [
        {
          id: 's',
          name: 'Passport',
          description: null,
          category: null,
          durationMinutes: 20,
          locations: [
            { id: 'l', name: 'Town hall', address: null, timeZone: 'Europe/Berlin', tenantId: 'x' },
          ],
          maxParticipantsPerBooking: 1,
          information: [{ field: 'email', isRequired: true, internal: 1 }],
          requiredDocuments: [],
          instructions: null,
          horizonDays: 30,
          cancellationAllowed: true,
          cancellationDeadlineMinutes: 60,
          resourceIds: ['r1'],
        },
      ],
    } as unknown as PublicCatalogView);
    expect(JSON.stringify(dto)).not.toMatch(/tenantId|resourceIds|internal/);
    expect(dto.services[0]?.locations[0]).toEqual({
      id: 'l',
      name: 'Town hall',
      address: null,
      timeZone: 'Europe/Berlin',
    });
  });
});
