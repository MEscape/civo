import { OverviewTile } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

import { doneCount } from '../../forms/day-plan';
import { matchingCount } from '../../forms/open-bookings';
import { createZonedFormat } from '../../hooks/use-zoned-format';
import { bookingRoutes } from '../../routes';

import type { OpenBookingDto } from '../../dto/booking-dto';
import type { DayPlanDto } from '../../dto/employee-dto';

export interface EmployeeStartTilesProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly plan: DayPlanDto;
  /** The open bookings on offer; `null` when the person may not take any. */
  readonly open: readonly OpenBookingDto[] | null;
  readonly unread: number;
}

/** The figures of the employee's day as tiles, like the workspace overview's: each is the way to its page. */
export async function EmployeeStartTiles({
  locale,
  websiteId,
  plan,
  open,
  unread,
}: EmployeeStartTilesProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    getAppFormatters(),
  ]);
  const zoned = createZonedFormat(locale);
  const total = plan.items.length;
  const next = plan.items.find((item) => item.booking.id === plan.next?.bookingId);
  const planHref = bookingRoutes.mePlan(websiteId);

  return (
    // Without the open-bookings tile there are three: they share the row instead of leaving a gap.
    <div
      className={cn('grid grid-cols-2 gap-3', open === null ? 'md:grid-cols-3' : 'md:grid-cols-4')}
    >
      <OverviewTile
        label={t('employee.start.tiles.today')}
        value={format.number(total)}
        detail={
          total === 0
            ? t('employee.start.tiles.todayNone')
            : t('employee.start.tiles.todayDone', { done: doneCount(plan.items), total })
        }
        href={planHref}
      />
      <OverviewTile
        label={t('employee.start.tiles.next')}
        value={next === undefined ? '–' : zoned.time(next.booking.start, next.booking.timeZone)}
        detail={next?.labels.serviceName ?? t('employee.start.tiles.nextNone')}
        href={planHref}
      />
      {open !== null && (
        <OverviewTile
          label={t('employee.start.tiles.open')}
          value={format.number(matchingCount(open))}
          detail={t('employee.start.tiles.openDetail')}
          href={bookingRoutes.meOpen(websiteId)}
        />
      )}
      <OverviewTile
        label={t('employee.start.tiles.messages')}
        value={format.number(unread)}
        detail={t('employee.start.tiles.messagesDetail')}
        tone={unread > 0 ? 'warning' : 'default'}
        href={bookingRoutes.meMessages(websiteId)}
      />
    </div>
  );
}
