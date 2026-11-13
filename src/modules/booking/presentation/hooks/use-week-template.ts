'use client';

import { useState } from 'react';

import { WEEK_TEMPLATES, changedDays } from '../forms/week/templates';

import type { DayDto } from '../dto/location-dto';
import type { WeekDraft } from '../forms/week/draft';
import type { WeekTemplateKey } from '../forms/week/templates';

/**
 * The template being asked about, what it would change day by day, and applying or dropping it:
 * nothing changes in the week until it is applied.
 */
export function useWeekTemplate(value: WeekDraft, onApply: (week: DayDto[]) => void) {
  const [pending, setPending] = useState<WeekTemplateKey | null>(null);

  const changes = pending === null ? [] : changedDays(value, WEEK_TEMPLATES[pending]);
  const choose = (key: WeekTemplateKey) => {
    setPending(key);
  };
  const apply = () => {
    if (pending !== null) {
      onApply(WEEK_TEMPLATES[pending].map((day) => ({ ...day })));
      setPending(null);
    }
  };
  const drop = () => {
    setPending(null);
  };

  return { pending, changes, choose, apply, drop };
}
