'use client';

import { useId } from 'react';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useZonedFormat } from '../../hooks/use-zoned-format';

import type { SlotDto } from '../../dto/availability-dto';

type DayPart = 'morning' | 'afternoon' | 'evening';

const DAY_PARTS: readonly DayPart[] = ['morning', 'afternoon', 'evening'];
const MORNING_END = '12:00';
const AFTERNOON_END = '17:00';
/** A group of places is worth mentioning only when it is getting short. */
const FEW_PLACES = 10;

function dayPartOf(localTime: string): DayPart {
  if (localTime < MORNING_END) {
    return 'morning';
  }
  return localTime < AFTERNOON_END ? 'afternoon' : 'evening';
}

function hasFewPlaces(remaining: number): boolean {
  return remaining > 1 && remaining <= FEW_PLACES;
}

export interface TimeListProps {
  readonly date: string;
  readonly times: readonly SlotDto[];
  readonly selectedStart: string | null;
  readonly disabled: boolean;
  readonly onSelect: (slot: SlotDto) => void;
}

/** The times of one day as a radio group, split into morning, afternoon and evening. */
export function TimeList({ date, times, selectedStart, disabled, onSelect }: TimeListProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');
  const groupName = useId();
  const labelId = useId();

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="space-y-3">
      <h4 id={labelId} className="text-sm font-medium text-copy">
        {t('time.timesOn', { date: format.longDate(date) })}
      </h4>
      {DAY_PARTS.map((part) => {
        const inPart = times.filter((slot) => dayPartOf(slot.localTime) === part);
        if (inPart.length === 0) {
          return null;
        }
        return (
          <div key={part} className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-copy-muted">
              {t(`time.parts.${part}`)}
            </p>
            <div className="flex flex-wrap gap-2">
              {inPart.map((slot) => (
                <label
                  key={slot.start}
                  className={cn(
                    'relative flex min-w-20 cursor-pointer flex-col items-center rounded-token border px-3 py-2 text-sm',
                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                    slot.start === selectedStart
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border-strong bg-surface text-copy hover:bg-canvas',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input
                    type="radio"
                    name={groupName}
                    className="sr-only"
                    checked={slot.start === selectedStart}
                    disabled={disabled}
                    onChange={() => {
                      onSelect(slot);
                    }}
                  />
                  <span>{format.timeOfDay(slot.localTime)}</span>
                  {hasFewPlaces(slot.remainingParticipants) && (
                    <span className="text-xs opacity-80">
                      {t('time.placesLeft', { count: slot.remainingParticipants })}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
