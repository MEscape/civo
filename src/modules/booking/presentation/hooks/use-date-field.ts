'use client';

import { useState } from 'react';

import { z } from 'zod';

import { useAnchoredPosition } from '@hooks/use-anchored-position';

import { daysOfMonth, monthOf } from '../forms/month-calendar';

import { useDisclosureMenu } from './use-disclosure-menu';

interface DateFieldOptions {
  readonly value?: string | undefined;
  readonly defaultValue?: string | undefined;
  readonly min?: string | undefined;
  readonly max?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly onValueChange?: ((value: string) => void) | undefined;
}

const FIRST_DAY = '0001-01-01';
const LAST_DAY = '9999-12-31';
const INITIAL_MONTH = '2000-01';
const YEAR_DIGITS = 4;
const dateSchema = z.iso.date();

/** Date entry and calendar disclosure share one value; manual input remains editable until validation. */
export function useDateField({
  value,
  defaultValue,
  min = FIRST_DAY,
  max = LAST_DAY,
  disabled = false,
  onValueChange,
}: DateFieldOptions) {
  const [draft, setDraft] = useState(defaultValue ?? '');
  const [month, setMonth] = useState(INITIAL_MONTH);
  const disclosure = useDisclosureMenu();
  useAnchoredPosition(disclosure.isOpen, disclosure.rootRef, disclosure.panelId);
  const current = value ?? draft;
  const chosenDay = dateSchema.safeParse(current).success ? current : null;
  const change = (next: string) => {
    if (disabled) {
      return;
    }
    if (value === undefined) {
      setDraft(next);
    }
    onValueChange?.(next);
  };

  return {
    ...disclosure,
    value: current,
    month,
    chosenDay,
    firstDay: min,
    lastDay: max,
    freeDays: daysOfMonth(month).filter((day) => day >= min && day <= max),
    change,
    setMonth,
    toggle: () => {
      if (disabled) {
        return;
      }
      if (!disclosure.isOpen) {
        const now = new Date();
        const today = `${String(now.getFullYear()).padStart(YEAR_DIGITS, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const start = chosenDay ?? today;
        const atLeastMin = start < min ? min : start;
        setMonth(monthOf(atLeastMin > max ? max : atLeastMin));
      }
      disclosure.toggle();
    },
    choose: (day: string) => {
      if (disabled || day < min || day > max || !dateSchema.safeParse(day).success) {
        return;
      }
      change(day);
      disclosure.close();
      disclosure.buttonRef.current?.focus();
    },
  };
}
