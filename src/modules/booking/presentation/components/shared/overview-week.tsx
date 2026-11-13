// @ui-plain table A visually hidden twin of the chart for assistive technology; the design-system Table draws a visible panel.

import { Calendar } from '@components/icons/icons';
import {
  OverviewPanel,
  OverviewRow,
  OverviewStat,
  OverviewStats,
} from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { WEEK_DAYS, weekOf } from '../../forms/overview-week';
import { bookingRoutes } from '../../routes';

import { BookingEmptyState } from './booking-empty-state';
import { OverviewWeekChart } from './overview-week-chart.client';

import type { BookingView } from '../../../application/contracts/booking-views';

export interface OverviewWeekProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The first day of the week drawn (today); `null` while there is no location, hence no calendar. */
  readonly from: string | null;
  /** The bookings of the week; `null` when they could not be read or there is nothing to read yet. */
  readonly items: readonly BookingView[] | null;
}

/** Noon of a UTC day: the same calendar date in every time zone the app formats in. */
const dayInstant = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * The week ahead as a chart: confirmed bookings per day, with those that still wait for an employee
 * on top. Like the website's own activity card (one number row, one chart, one hidden table), and
 * as tall as the panel beside it.
 */
export async function OverviewWeek({ locale, websiteId, from, items }: OverviewWeekProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    getAppFormatters(),
  ]);
  const days = from === null || items === null ? [] : weekOf(items, from, WEEK_DAYS);
  const total = days.reduce((sum, day) => sum + day.covered + day.waiting, 0);
  const waiting = days.reduce((sum, day) => sum + day.waiting, 0);
  const chartDays = days.map((day) => ({
    ...day,
    label: format.date(dayInstant(day.day), { weekday: 'short', day: 'numeric' }),
    summary: t('home.week.daySummary', {
      date: format.date(dayInstant(day.day), { weekday: 'short', day: 'numeric', month: 'short' }),
      total: day.covered + day.waiting,
      waiting: day.waiting,
    }),
  }));

  return (
    <OverviewPanel
      title={t('home.week.title')}
      {...(from === null
        ? {}
        : { link: { href: bookingRoutes.bookingCalendar(websiteId), label: t('home.week.link') } })}
      className="h-full"
    >
      <OverviewRow className="flex flex-1 flex-col gap-3">
        <OverviewStats>
          <OverviewStat label={t('home.week.total')} value={format.number(total)} />
          <OverviewStat
            label={t('home.week.waiting')}
            value={format.number(waiting)}
            tone={waiting > 0 ? 'warning' : 'default'}
          />
        </OverviewStats>
        {total === 0 ? (
          <BookingEmptyState
            icon={<Calendar aria-hidden="true" />}
            className="flex-1"
            title={t('home.week.emptyTitle')}
            description={t('home.week.emptyBody')}
          />
        ) : (
          <>
            <div className="relative min-h-40 flex-1">
              <div className="absolute inset-0">
                <OverviewWeekChart
                  days={chartDays}
                  names={{ covered: t('home.week.covered'), waiting: t('home.week.waitingSeries') }}
                />
              </div>
            </div>
            <ul
              aria-hidden="true"
              className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-copy-muted"
            >
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-token-sm bg-chart-1" />
                {t('home.week.covered')}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-token-sm bg-warning" />
                {t('home.week.waitingSeries')}
              </li>
            </ul>
            <div className="sr-only">
              <table>
                <caption>{t('home.week.tableCaption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('home.week.day')}</th>
                    <th scope="col">{t('home.week.covered')}</th>
                    <th scope="col">{t('home.week.waitingSeries')}</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.day}>
                      <th scope="row">{format.date(dayInstant(day.day))}</th>
                      <td>{day.covered}</td>
                      <td>{day.waiting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </OverviewRow>
    </OverviewPanel>
  );
}
