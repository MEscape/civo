'use client';

import { useState } from 'react';

import { Label } from '@components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import { dayAfter } from '../../forms/month-calendar';
import { DateField } from '../shared/date-field.client';

/** The days after today the quick periods end: seven and thirty days, today counted. */
const WEEK_ENDS_AFTER = 6;
const MONTH_ENDS_AFTER = 29;

const PERIODS = ['any', 'today', 'week', 'month', 'custom'] as const;
type Period = (typeof PERIODS)[number];

/** The days a quick period covers, from today on; `any` and `custom` have none of their own. */
function daysOf(period: Period, today: string): { from: string; to: string } | null {
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: today, to: dayAfter(today, WEEK_ENDS_AFTER) };
    case 'month':
      return { from: today, to: dayAfter(today, MONTH_ENDS_AFTER) };
    default:
      return null;
  }
}

/** Which choice the days in the address stand for: none, one of the quick periods, or a range typed by hand. */
function periodOf(from: string | undefined, to: string | undefined, today: string): Period {
  if (from === undefined && to === undefined) {
    return 'any';
  }
  const quick = (['today', 'week', 'month'] as const).find((period) => {
    const days = daysOf(period, today);
    return days !== null && days.from === from && days.to === to;
  });
  return quick ?? 'custom';
}

export interface PeriodFilterProps {
  /** The day the quick periods start from, as the request knows it. */
  readonly today: string;
  readonly from: string | undefined;
  readonly to: string | undefined;
}

/**
 * The period of a list as one select of the filter form, like the audit trail's: any time, today, the
 * next seven or thirty days, or a range of two days typed by hand. The days travel as `from` and `to`,
 * so the address stays what it was; the two date fields only show when the range is the user's own.
 */
export function PeriodFilter({ today, from, to }: PeriodFilterProps) {
  const t = useTranslations('booking');
  const [period, setPeriod] = useState<Period>(() => periodOf(from, to, today));
  const quick = daysOf(period, today);

  return (
    <>
      <div className="min-w-0 max-w-full">
        <Label htmlFor="bookings-period" className="sr-only">
          {t('bookings.filters.periods.label')}
        </Label>
        <Select
          value={period}
          onValueChange={(value) => {
            setPeriod(value as Period);
          }}
        >
          <SelectTrigger id="bookings-period" className="w-auto min-w-36 max-w-full gap-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((choice) => (
              <SelectItem key={choice} value={choice}>
                {t(`bookings.filters.periods.${choice}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {quick !== null && (
        <>
          <input type="hidden" name="from" value={quick.from} />
          <input type="hidden" name="to" value={quick.to} />
        </>
      )}
      {period === 'custom' && (
        <>
          <DateField
            id="bookings-from"
            name="from"
            label={t('bookings.filters.from')}
            placeholder={t('bookings.filters.from')}
            isLabelHidden
            defaultValue={from ?? ''}
          />
          <DateField
            id="bookings-to"
            name="to"
            label={t('bookings.filters.to')}
            placeholder={t('bookings.filters.to')}
            isLabelHidden
            defaultValue={to ?? ''}
          />
        </>
      )}
    </>
  );
}
