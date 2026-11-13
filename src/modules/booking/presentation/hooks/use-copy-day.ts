'use client';

import { useState } from 'react';

import { copyDay } from '../forms/week/draft';

import type { DayDto } from '../dto/location-dto';
import type { WeekDraft } from '../forms/week/draft';

/** The weekdays ticked as targets for "copy to other days", whether the list is open, and applying it. */
export function useCopyDay(week: WeekDraft, index: number, onChange: (week: DayDto[]) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [targets, setTargets] = useState<readonly number[]>([]);

  const toggle = (day: number, isTicked: boolean) => {
    setTargets(isTicked ? [...targets, day] : targets.filter((other) => other !== day));
  };
  const close = () => {
    setTargets([]);
    setIsOpen(false);
  };
  const apply = () => {
    onChange(copyDay(week, index, targets));
    close();
  };

  return {
    isOpen,
    open: () => {
      setIsOpen(true);
    },
    close,
    targets,
    toggle,
    apply,
  };
}
