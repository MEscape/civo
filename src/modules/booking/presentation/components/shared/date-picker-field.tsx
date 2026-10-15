'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';
import { Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useZonedFormat } from '../../hooks/use-zoned-format';
import {
  WEEKDAYS_MONDAY_FIRST,
  compareYearMonth,
  currentYearMonth,
  monthCells,
  shiftMonth,
  yearMonthOf,
} from '../../time/month-math';
import { MonthHeader } from '../flow/month-header';

import type { YearMonth } from '../../time/month-math';

const DAYS_PER_WEEK = 7;

const STEP_BY_KEY: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: DAYS_PER_WEEK,
  ArrowUp: -DAYS_PER_WEEK,
};

export interface DatePickerFieldProps {
  readonly id: string;
  readonly label: string;
  /** `YYYY-MM-DD`, or empty while no day is chosen. */
  readonly value: string;
  /** The first day that can be chosen, `YYYY-MM-DD`. */
  readonly min?: string | undefined;
  readonly disabled?: boolean;
  readonly error?: string | undefined;
  readonly onChange: (value: string) => void;
}

function startMonthOf(value: string, min: string | undefined): YearMonth {
  return yearMonthOf(value) ?? yearMonthOf(min ?? '') ?? currentYearMonth();
}

/**
 * A day chosen from a month grid in the application's own styling, instead of
 * the browser's date popup, which cannot be styled and differs by browser.
 * The chosen day is shown in the visitor's language. Arrow keys move between
 * days (up and down by a week), Escape closes and hands focus back to the button.
 */
export function DatePickerField({
  id,
  label,
  value,
  min,
  disabled = false,
  error,
  onChange,
}: DatePickerFieldProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');
  const panelId = useId();
  const errorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(() => startMonthOf(value, min));

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }
      const step = STEP_BY_KEY[event.key];
      const buttons = Array.from(
        gridRef.current?.querySelectorAll<HTMLButtonElement>('button[data-day]:not(:disabled)') ??
          [],
      );
      const index = buttons.findIndex((button) => button === document.activeElement);
      const target = step === undefined ? undefined : buttons[index + step];
      if (index !== -1 && target !== undefined) {
        event.preventDefault();
        target.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const target =
        gridRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
        gridRef.current?.querySelector<HTMLButtonElement>('button[data-day]:not(:disabled)');
      target?.focus();
    }
  }, [isOpen]);

  function open() {
    setMonth(startMonthOf(value, min));
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  const today = new Date().toISOString().slice(0, 'YYYY-MM-DD'.length);
  const minMonth = yearMonthOf(min ?? '');

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Button
        ref={triggerRef}
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        className="h-9 w-full justify-between px-3 font-normal"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            open();
          }
        }}
      >
        <span className={cn(value === '' && 'text-copy-muted')}>
          {value === '' ? t('picker.choose') : format.longDate(value)}
        </span>
        <Icons.calendar className="size-4 text-copy-muted" aria-hidden="true" />
      </Button>
      {error !== undefined && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="absolute left-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-token border border-border bg-surface p-3 shadow-lg"
        >
          <MonthHeader
            headingId={`${panelId}-month`}
            label={format.monthYear(`${month.year}-${String(month.month).padStart(2, '0')}-01`)}
            canGoBack={minMonth === null || compareYearMonth(month, minMonth) > 0}
            canGoForward
            disabled={false}
            onMove={(delta) => {
              setMonth((current) => shiftMonth(current, delta));
            }}
          />
          <div ref={gridRef} role="group" aria-labelledby={`${panelId}-month`}>
            <div
              className="grid grid-cols-7 gap-1 text-center text-xs text-copy-muted"
              aria-hidden="true"
            >
              {WEEKDAYS_MONDAY_FIRST.map((weekday) => (
                <span key={weekday}>{format.weekdayName(weekday, 'short')}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthCells(month).map((date, position) => {
                if (date === null) {
                  // eslint-disable-next-line react/no-array-index-key -- padding cells have no identity
                  return <span key={`pad-${position}`} />;
                }
                const isChosen = date === value;
                return (
                  <Button
                    key={date}
                    type="button"
                    variant="ghost"
                    data-day={date}
                    disabled={min !== undefined && date < min}
                    aria-pressed={isChosen}
                    aria-current={date === today ? 'date' : undefined}
                    aria-label={format.longDate(date)}
                    className={cn(
                      'h-9 w-full px-0',
                      date === today && !isChosen && 'bg-today',
                      isChosen && 'bg-primary text-primary-foreground hover:bg-primary',
                    )}
                    onClick={() => {
                      onChange(date);
                      close();
                    }}
                  >
                    {format.dayNumber(date)}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
