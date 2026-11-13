import { z } from 'zod';

import {
  BOOKING_ID_MAX_LENGTH,
  BOOKING_INPUT_LIMITS,
} from '../../application/contracts/booking-constraints';
import { BOOKING_LIST_STATES } from '../../application/contracts/booking-inputs';

import { ANY_FILTER } from './parse-service-list-input';

import type { BookingListState } from '../../application/contracts/booking-inputs';

/** The views of the calendar; the first is what an address without one shows. */
export const CALENDAR_VIEWS = ['week', 'day', 'month', 'list'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** What the addresses of the bookings list and the calendar share. */
export interface BookingFilterParams {
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly state: BookingListState | undefined;
  readonly locationId: string | undefined;
  readonly serviceId: string | undefined;
  /** An employee (or another resource) the bookings are held by. */
  readonly resourceId: string | undefined;
  readonly reference: string | undefined;
}

export interface BookingListParams extends BookingFilterParams {
  /** The booking whose details the side panel shows. */
  readonly bookingId: string | undefined;
  /** As the address carries it: untrusted, resolved and clamped by the use case. */
  readonly page: { readonly page: unknown; readonly pageSize: unknown };
}

export interface CalendarParams extends BookingFilterParams {
  readonly view: CalendarView;
  /** The day the shown period contains; today when absent. */
  readonly date: string | undefined;
}

/** A repeated parameter (`?q=a&q=b`) is its first value. */
const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

/** A value that does not fit is no value: the address can never cause an error page. */
const lenient = <T extends z.ZodType>(schema: T) =>
  z.preprocess(firstOf, schema.optional().catch(undefined));

const day = lenient(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
const id = lenient(z.string().trim().min(1).max(BOOKING_ID_MAX_LENGTH));

const paramsSchema = z.object({
  from: day,
  to: day,
  date: day,
  state: lenient(z.enum(BOOKING_LIST_STATES)),
  location: id,
  service: id,
  resource: id,
  booking: id,
  q: lenient(z.string().trim().max(BOOKING_INPUT_LIMITS.referenceMax)),
  view: lenient(z.enum(CALENDAR_VIEWS)),
  page: z.preprocess(firstOf, z.unknown()),
  pageSize: z.preprocess(firstOf, z.unknown()),
});

type Raw = Readonly<Record<string, string | string[] | undefined>>;

const anyAsNone = (value: string | undefined) =>
  value === undefined || value === '' || value === ANY_FILTER ? undefined : value;

function filtersOf(parsed: z.infer<typeof paramsSchema>): BookingFilterParams {
  return {
    from: parsed.from,
    to: parsed.to,
    state: parsed.state,
    locationId: anyAsNone(parsed.location),
    serviceId: anyAsNone(parsed.service),
    resourceId: anyAsNone(parsed.resource),
    reference: anyAsNone(parsed.q),
  };
}

/** What the address of the bookings list asks for, read without trusting it. */
export function parseBookingListParams(raw: Raw): BookingListParams {
  const parsed = paramsSchema.parse(raw);
  return {
    ...filtersOf(parsed),
    bookingId: parsed.booking,
    page: { page: parsed.page, pageSize: parsed.pageSize },
  };
}

/** What the address of the calendar asks for, read without trusting it. */
export function parseCalendarParams(raw: Raw): CalendarParams {
  const parsed = paramsSchema.parse(raw);
  return { ...filtersOf(parsed), view: parsed.view ?? 'week', date: parsed.date };
}
