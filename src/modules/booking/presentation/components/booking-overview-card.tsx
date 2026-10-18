import {
  OverviewCard,
  OverviewRow,
  OverviewStat,
  OverviewStats,
} from '@components/shared/overview-card';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { bookingRoutes } from '../routes';

import type { BookingSummaryView } from '../../application/contracts/calendar-views';

export interface BookingOverviewCardProps {
  readonly websiteId: string;
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
  readonly summary: BookingSummaryView;
}

/**
 * The bookings at a glance for the website overview: appointments today, the
 * coming days and the next few. What it shows follows the calendar's own
 * rule: all bookings for staff, only one's own for an employee.
 */
export async function BookingOverviewCard({
  websiteId,
  locale,
  summary,
}: BookingOverviewCardProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    getAppFormatters(),
  ]);
  const { hasLocation, today, upcoming, days, next } = summary;

  return (
    <OverviewCard
      title={t('overview.title')}
      link={{ href: bookingRoutes.admin(websiteId), label: t('overview.link') }}
    >
      {hasLocation ? (
        <>
          <OverviewRow>
            <OverviewStats>
              <OverviewStat label={t('overview.today')} value={format.number(today)} />
              <OverviewStat
                label={t('overview.upcoming', { days })}
                value={format.number(upcoming)}
              />
            </OverviewStats>
          </OverviewRow>
          {next.length === 0 ? (
            <OverviewRow>
              <p className="text-sm text-copy-muted">{t('overview.empty')}</p>
            </OverviewRow>
          ) : (
            next.map((booking) => (
              <OverviewRow key={booking.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-copy">{booking.serviceName}</p>
                  <p className="truncate text-xs text-copy-muted">
                    {booking.customerName ?? t('overview.noCustomer')}
                  </p>
                </div>
                <time
                  dateTime={booking.start.toISOString()}
                  className="shrink-0 text-xs text-copy-muted"
                >
                  {format.dateTime(booking.start)}
                </time>
              </OverviewRow>
            ))
          )}
        </>
      ) : (
        <OverviewRow>
          <p className="text-sm text-copy-muted">{t('overview.noLocation')}</p>
        </OverviewRow>
      )}
    </OverviewCard>
  );
}
