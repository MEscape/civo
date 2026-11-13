'use client';

import { DataPanel, DataPanelBody } from '@components/shared/data-panel';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { timeOf } from '../../forms/week/time';
import { useBookingWebsite } from '../../hooks/use-booking-website';
import { bookingRoutes } from '../../routes';
import { TimeRangeRow } from '../shared/time-range-row.client';

import { WindowBar } from './window-bar';

import type { RangeDto } from '../../dto/location-dto';

export interface PreferencesWindowPanelProps {
  /** The preferred time window in minutes of the day; `null` when the person has none. */
  readonly window: { readonly startMinute: number; readonly endMinute: number } | null;
  readonly startError: string | undefined;
  readonly endError: string | undefined;
  readonly disabled: boolean;
  readonly onChange: (range: RangeDto | null) => void;
  readonly onAdd: () => void;
}

/**
 * The time-of-day window the employee would like to work in. It only orders what they are offered; the
 * panel says so and points to the calendar, whose working hours decide when they can be booked.
 */
export function PreferencesWindowPanel({
  window,
  startError,
  endError,
  disabled,
  onChange,
  onAdd,
}: PreferencesWindowPanelProps) {
  const t = useTranslations('booking');
  const websiteId = useBookingWebsite();

  return (
    <DataPanel
      title={t('employee.preferences.window.title')}
      description={t('employee.preferences.window.description')}
    >
      <DataPanelBody className="space-y-4 sm:p-4">
        {window === null ? (
          <div className="space-y-3">
            <p className="text-sm text-copy-muted">{t('employee.preferences.window.none')}</p>
            <Button type="button" variant="outline" disabled={disabled} onClick={onAdd}>
              {t('employee.preferences.window.add')}
            </Button>
          </div>
        ) : (
          <>
            <TimeRangeRow
              id="pref-window"
              range={{ start: timeOf(window.startMinute), end: timeOf(window.endMinute) }}
              startLabel={t('employee.preferences.window.start')}
              endLabel={t('employee.preferences.window.end')}
              removeLabel={t('employee.preferences.window.remove')}
              startError={startError}
              endError={endError}
              disabled={disabled}
              onChange={onChange}
              onRemove={() => {
                onChange(null);
              }}
            />
            <WindowBar startMinute={window.startMinute} endMinute={window.endMinute} />
            <p className="text-sm text-copy-muted">{t('employee.preferences.window.effect')}</p>
          </>
        )}
        <p className="border-t border-border pt-3 text-xs text-copy-muted">
          {t('employee.preferences.window.difference')}{' '}
          <Link
            href={bookingRoutes.ownProfile(websiteId)}
            className="font-medium text-primary-copy underline underline-offset-2"
          >
            {t('employee.preferences.window.differenceLink')}
          </Link>
        </p>
      </DataPanelBody>
    </DataPanel>
  );
}
