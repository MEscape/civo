import type { OpenBookingDto } from '@modules/booking/presentation/dto/booking-dto';
import type { DayPlanDto, DayPlanItemDto } from '@modules/booking/presentation/dto/employee-dto';

/** What an employee sees of a booking in the views of their own area, with no customer. */
function employeeBooking(id: string, start: string, end: string) {
  return {
    websiteId: 'site',
    id,
    reference: `REF${id}`,
    status: 'confirmed' as const,
    serviceId: 'svc-1',
    locationId: 'loc-1',
    timeZone: 'Europe/Berlin',
    start,
    end,
    units: [{ requirementIndex: 0, resourceType: 'employee' as const, resourceId: null }],
    assignment: 'open' as const,
    holdExpiresAt: null,
    rescheduleCount: 0,
    cancelledAt: null,
    createdAt: '2027-01-10T09:00:00+01:00',
  };
}

export function openBooking(
  id: string,
  level: OpenBookingDto['fit']['level'],
  serviceName: string,
): OpenBookingDto {
  return {
    booking: employeeBooking(id, '2027-01-14T09:30:00+01:00', '2027-01-14T10:00:00+01:00'),
    fit: {
      level,
      reasons: level === 'very-good' ? ['service-preferred', 'time-in-window'] : [],
    },
    labels: { serviceName, locationName: 'Bürgerbüro Mitte', resourceNames: ['Schalter 1'] },
  };
}

export function planItem(
  id: string,
  phase: DayPlanItemDto['phase'],
  times: readonly [string, string],
  overrides: Partial<DayPlanItemDto> = {},
): DayPlanItemDto {
  return {
    booking: employeeBooking(
      id,
      `2027-01-14T${times[0]}:00+01:00`,
      `2027-01-14T${times[1]}:00+01:00`,
    ),
    labels: {
      serviceName: 'Meldebescheinigung',
      locationName: 'Bürgerbüro Mitte',
      resourceNames: ['Schalter 2'],
    },
    phase,
    requiredDocuments: ['Ausweis', 'Wohnungsgeberbestätigung'],
    instructions: 'Adresse mit dem Ausweis vergleichen.',
    mayHandBack: true,
    mayRecordOutcome: false,
    ...overrides,
  };
}

export function dayPlan(items: readonly DayPlanItemDto[]): DayPlanDto {
  return {
    date: '2027-01-14',
    today: '2027-01-14',
    timeZone: 'Europe/Berlin',
    items,
    next: null,
    workday: null,
    hasCalendar: true,
  };
}
