import { toWallClock } from '../time/zoned-time';

import type {
  AlternativeSlotsView,
  AvailabilityView,
  SlotView,
} from '../../application/contracts/booking-views';

/**
 * One bookable start time. `localDate` and `localTime` are the wall-clock
 * values at the LOCATION, computed on the server so every screen groups and
 * labels slots by the place's calendar, whatever zone the browser is in.
 */
export interface SlotDto {
  readonly start: string;
  readonly end: string;
  readonly localDate: string;
  readonly localTime: string;
  readonly remainingParticipants: number;
}

export interface AvailabilityDto {
  readonly serviceId: string;
  readonly locationId: string;
  readonly timeZone: string;
  readonly from: string;
  readonly to: string;
  readonly slots: readonly SlotDto[];
}

export interface AlternativeSlotsDto {
  readonly timeZone: string;
  readonly slots: readonly SlotDto[];
}

export function toSlotDto(slot: SlotView, timeZone: string): SlotDto {
  const { date, time } = toWallClock(slot.start, timeZone);
  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    localDate: date,
    localTime: time,
    remainingParticipants: slot.remainingParticipants,
  };
}

export function toAvailabilityDto(view: AvailabilityView): AvailabilityDto {
  return {
    serviceId: view.serviceId,
    locationId: view.locationId,
    timeZone: view.timeZone,
    from: view.from,
    to: view.to,
    slots: view.slots.map((slot) => toSlotDto(slot, view.timeZone)),
  };
}

export function toAlternativeSlotsDto(view: AlternativeSlotsView): AlternativeSlotsDto {
  return {
    timeZone: view.timeZone,
    slots: view.slots.map((slot) => toSlotDto(slot, view.timeZone)),
  };
}
