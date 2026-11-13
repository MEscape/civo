'use client';

import { useState } from 'react';

import { DEFAULT_HOURS_RANGE, widenRange } from '../forms/week/range';

import type { DayDto } from '../dto/location-dto';
import type { HoursRange } from '../forms/week/range';

/** The range the bars of some days are drawn on: the default, widened by what is set, and never narrower again while the editor is open. */
export function useHoursRange(days: readonly DayDto[]): HoursRange {
  const [range, setRange] = useState(() => widenRange(DEFAULT_HOURS_RANGE, days));
  const wider = widenRange(range, days);
  if (wider !== range) {
    setRange(wider);
  }
  return wider;
}
