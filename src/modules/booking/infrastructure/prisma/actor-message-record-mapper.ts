import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isPlainObject, isString } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { CALENDAR_CHANGED, MESSAGE_KINDS } from '../../domain/models/actor-message';
import { MANAGER_CHANGE_PARTS } from '../../domain/models/employee-calendar';
import { toBookableServiceId, toBookingId, toBookingLocationId } from '../../domain/models/ids';
import { instantToDate, parseInstant } from '../../domain/time/instant';

import { readInstant, readOptionalInstant } from './instant-record-mapper';

import type { ActorMessage, CalendarNotice, MessageKind } from '../../domain/models/actor-message';
import type { Booking } from '../../domain/models/booking';
import type { ManagerChangePart } from '../../domain/models/employee-calendar';

export const MESSAGE_SELECT = ['id', 'type', 'bookingId', 'params', 'createdAt', 'readAt'] as const;

export interface ActorMessageRecord {
  readonly id: string;
  readonly type: string;
  readonly bookingId: string | null;
  readonly params: unknown;
  readonly createdAt: InstantRecord;
  readonly readAt: InstantRecord | null;
}

/** What a message keeps of its booking: the booking as the change left it, never a name or a customer. */
export function toMessageParams(booking: Booking) {
  return {
    serviceId: booking.serviceId,
    locationId: booking.locationId,
    start: instantToDate(booking.start).toISOString(),
    end: instantToDate(booking.end).toISOString(),
  };
}

/** What a message about the calendar keeps: where, and which parts changed. */
export function toCalendarParams({ locationId, parts }: CalendarNotice) {
  return { locationId, parts: [...parts] };
}

const isKind = (value: string): value is MessageKind =>
  (MESSAGE_KINDS as readonly string[]).includes(value);
const isPart = (value: unknown): value is ManagerChangePart =>
  isString(value) && (MANAGER_CHANGE_PARTS as readonly string[]).includes(value);

const textOf = (params: Record<string, unknown>, key: string) => {
  const value = params[key];
  return isString(value) && value.length > 0 ? value : null;
};

type MessageBase = Pick<ActorMessage, 'id' | 'locationId' | 'createdAt' | 'readAt'>;

const failed = () => err(bookingDataInvalid('message'));

function toCalendarMessage(
  base: MessageBase,
  params: Record<string, unknown>,
): AppResult<ActorMessage, InfrastructureAppError> {
  const parts = params['parts'];
  return Array.isArray(parts) && parts.every(isPart)
    ? ok({ ...base, type: CALENDAR_CHANGED, parts })
    : failed();
}

function toBookingMessage(
  record: ActorMessageRecord,
  base: MessageBase,
  params: Record<string, unknown>,
): AppResult<ActorMessage, InfrastructureAppError> {
  const serviceId = textOf(params, 'serviceId');
  const start = parseInstant(textOf(params, 'start') ?? '');
  const end = parseInstant(textOf(params, 'end') ?? '');
  if (
    serviceId === null ||
    start === null ||
    end === null ||
    record.bookingId === null ||
    !isKind(record.type)
  ) {
    return failed();
  }
  return ok({
    ...base,
    type: record.type,
    bookingId: toBookingId(record.bookingId),
    serviceId: toBookableServiceId(serviceId),
    start,
    end,
  });
}

/** A stored message as the inbox reads it; a row in another shape is a failure, never half a message. */
export function toActorMessage(
  record: ActorMessageRecord,
): AppResult<ActorMessage, InfrastructureAppError> {
  const { params } = record;
  const locationId = isPlainObject(params) ? textOf(params, 'locationId') : null;
  const createdAt = readInstant(record.createdAt);
  const readAt = readOptionalInstant(record.readAt);
  if (!isPlainObject(params) || locationId === null || createdAt === null || readAt === undefined) {
    return failed();
  }
  const base = { id: record.id, locationId: toBookingLocationId(locationId), createdAt, readAt };
  return record.type === CALENDAR_CHANGED
    ? toCalendarMessage(base, params)
    : toBookingMessage(record, base, params);
}
