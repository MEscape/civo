import { toWallClock } from '../time/zoned-time';

import type { BookingStatus } from '../../application/contracts/booking-constraints';
import type { BookingView, HoldView } from '../../application/contracts/booking-views';

export interface HoldDto {
  readonly holdId: string;
  readonly expiresAt: string;
  readonly start: string;
  readonly end: string;
  readonly localDate: string;
  readonly localTime: string;
  readonly participants: number;
  readonly timeZone: string;
  readonly serviceName: string;
  readonly locationName: string;
}

export interface BookingDto {
  readonly reference: string;
  readonly status: BookingStatus;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly locationAddress: string | null;
  readonly timeZone: string;
  readonly start: string;
  readonly end: string;
  readonly localDate: string;
  readonly localTime: string;
  readonly participants: number;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  readonly canCancel: boolean;
  readonly canReschedule: boolean;
  readonly rescheduleCount: number;
}

export function toHoldDto(view: HoldView): HoldDto {
  const { date, time } = toWallClock(view.start, view.timeZone);
  return {
    holdId: view.holdId,
    expiresAt: view.expiresAt.toISOString(),
    start: view.start.toISOString(),
    end: view.end.toISOString(),
    localDate: date,
    localTime: time,
    participants: view.participants,
    timeZone: view.timeZone,
    serviceName: view.serviceName,
    locationName: view.locationName,
  };
}

export function toBookingDto(view: BookingView): BookingDto {
  const { date, time } = toWallClock(view.start, view.timeZone);
  return {
    reference: view.reference,
    status: view.status,
    serviceId: view.serviceId,
    serviceName: view.serviceName,
    locationId: view.locationId,
    locationName: view.locationName,
    locationAddress: view.locationAddress,
    timeZone: view.timeZone,
    start: view.start.toISOString(),
    end: view.end.toISOString(),
    localDate: date,
    localTime: time,
    participants: view.participants,
    firstName: view.firstName,
    lastName: view.lastName,
    email: view.email,
    requiredDocuments: view.requiredDocuments,
    instructions: view.instructions,
    canCancel: view.canCancel,
    canReschedule: view.canReschedule,
    rescheduleCount: view.rescheduleCount,
  };
}
