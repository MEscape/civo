'use client';

import type { ActionResult } from '@lib/result';

import { freeDaysOf, monthSpan } from '../forms/month-calendar';

import type { AvailableSlotsDto } from '../dto/booking-dto';
import type { SlotDto } from '../forms/journey-state';

/** What the free times are asked for: a service at a location. */
export interface SlotTarget {
  readonly serviceId: string;
  readonly locationId: string;
}

/**
 * How the free starts are read for a span of days: for a new booking the public catalog's, for a
 * booking being moved the move's own question (so a time offered is a time the move accepts).
 */
export type SlotReader = (
  target: SlotTarget,
  span: { readonly from: string; readonly to: string },
) => Promise<ActionResult<AvailableSlotsDto>>;

/** An answer, or the code the server refused with. */
export type SlotAnswer<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: string };

/**
 * Reads the free starts the visitor looks at, and only those: the days of the month on screen
 * (from the location's today), then the times of one day. Each answer is the server's, read when
 * the visitor asks; nothing is computed in the browser.
 */
export function useSlotSearch(read: SlotReader) {
  async function freeDays(
    target: SlotTarget,
    month: string,
    today: string,
  ): Promise<SlotAnswer<readonly string[]>> {
    const span = monthSpan(month, today);
    if (span === null) {
      return { ok: true, value: [] };
    }
    const result = await read(target, span);
    if (!result.ok) {
      return { ok: false, code: result.error.code };
    }
    return { ok: true, value: freeDaysOf(month, result.data) };
  }

  async function freeTimes(
    target: SlotTarget,
    day: string,
  ): Promise<SlotAnswer<readonly SlotDto[]>> {
    const result = await read(target, { from: day, to: day });
    return result.ok
      ? { ok: true, value: result.data.slots }
      : { ok: false, code: result.error.code };
  }

  return { freeDays, freeTimes };
}
