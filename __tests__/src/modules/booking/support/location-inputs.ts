import type {
  DayInput,
  LocationInput,
} from '@modules/booking/application/contracts/location-inputs';

export const CLOSED: DayInput = { intervals: [], breaks: [] };

/** An office day: open 08:00 to `close` with a break at noon. */
export function officeDay(close = '18:00'): DayInput {
  return {
    intervals: [{ start: '08:00', end: close }],
    breaks: [{ start: '12:00', end: '13:00' }],
  };
}

/** Monday to Thursday until 18:00, Friday until 16:00, closed at the weekend. */
export function officeWeek(overrides: Readonly<Record<number, DayInput>> = {}): DayInput[] {
  return [
    officeDay(),
    officeDay(),
    officeDay(),
    officeDay(),
    officeDay('16:00'),
    CLOSED,
    CLOSED,
  ].map((day, index) => overrides[index] ?? day);
}

export function locationInput(overrides: Partial<LocationInput> = {}): LocationInput {
  return {
    name: 'Bürgerbüro Mitte',
    address: 'Rathausplatz 1, 10178 Berlin',
    timeZone: 'Europe/Berlin',
    isActive: true,
    openingHours: { weekly: officeWeek(), exceptions: [] },
    ...overrides,
  };
}
