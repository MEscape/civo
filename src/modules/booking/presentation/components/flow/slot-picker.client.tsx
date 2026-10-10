'use client';

import { useId } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useMonthAvailability } from '../../hooks/use-month-availability';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { ErrorNotice } from '../shared/error-notice';

import { MonthHeader } from './month-header';
import { MonthSlots } from './month-slots.client';
import { PickerSkeleton } from './picker-skeleton';

import type { SlotDto } from '../../dto/availability-dto';

export interface SlotPickerProps {
  readonly websiteId: string;
  readonly serviceId: string;
  readonly locationId: string;
  readonly participants: number;
  /** The furthest ahead a visitor can book, in days; the picker will not page past it. */
  readonly horizonDays: number;
  /** The slot already chosen, if any, so it is shown as selected when the picker opens. */
  readonly selectedStart: string | null;
  readonly disabled?: boolean;
  readonly onSelect: (slot: SlotDto, timeZone: string) => void;
}

/**
 * Purpose-built slot picker: a month of days (only days with free times can
 * be chosen) and the times of the chosen day as a radio group. It shows the
 * wall-clock time AT THE LOCATION and says so, and it always reads live
 * availability from the server; nothing here is cached or assumed free.
 */
export function SlotPicker({
  websiteId,
  serviceId,
  locationId,
  participants,
  horizonDays,
  selectedStart,
  disabled = false,
  onSelect,
}: SlotPickerProps) {
  const t = useTranslations('booking');
  const headingId = useId();
  const { month, from, outcome, canGoBack, canGoForward, goToMonth, retry } = useMonthAvailability({
    websiteId,
    serviceId,
    locationId,
    participants,
    horizonDays,
    hasSelection: selectedStart !== null,
  });
  const availability = outcome?.kind === 'ready' ? outcome.availability : null;
  const format = useZonedFormat(availability?.timeZone ?? 'UTC');

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <MonthHeader
        headingId={headingId}
        label={format.monthYear(from)}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        disabled={disabled}
        onMove={goToMonth}
      />

      {outcome === null && <PickerSkeleton label={t('time.loading')} />}

      {outcome?.kind === 'failed' && (
        <div className="space-y-3">
          <ErrorNotice code={outcome.code} />
          <Button type="button" variant="outline" onClick={retry}>
            {t('time.retry')}
          </Button>
        </div>
      )}

      {availability !== null && (
        <MonthSlots
          key={from}
          month={month}
          monthLabel={format.monthYear(from)}
          availability={availability}
          selectedStart={selectedStart}
          disabled={disabled}
          onSelect={onSelect}
        />
      )}
    </section>
  );
}
