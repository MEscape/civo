import { Calendar, Mail } from '@components/icons/icons';
import { OverviewPanel, OverviewRow } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { matchingCount } from '../../forms/open-bookings';
import { createZonedFormat } from '../../hooks/use-zoned-format';
import { bookingRoutes } from '../../routes';
import { BookingEmptyState } from '../shared/booking-empty-state';

import { BookingLabels } from './booking-labels';
import { EmployeeStartActions } from './employee-start-actions';
import { EmployeeStartTiles } from './employee-start-tiles';
import { MessageLine } from './message-line';
import { NextAppointment } from './next-appointment';
import { PhaseChip } from './phase-chip';

import type { OpenBookingDto } from '../../dto/booking-dto';
import type { DayPlanDto, MessageDto } from '../../dto/employee-dto';

export interface EmployeeStartProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly plan: DayPlanDto;
  /** The open bookings on offer; `null` when the person may not take any. */
  readonly open: readonly OpenBookingDto[] | null;
  readonly unread: number;
  /** The newest unread messages. */
  readonly fresh: readonly MessageDto[];
}

/**
 * The start of the employee's own area, built like the workspace overview: the figures of the day as
 * tiles, today's appointments beside the way to the rest, and the newest messages. The next appointment
 * stands above the day as the one thing to look at first.
 */
export async function EmployeeStart({
  locale,
  websiteId,
  plan,
  open,
  unread,
  fresh,
}: EmployeeStartProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const zoned = createZonedFormat(locale);
  const total = plan.items.length;
  const next = plan.items.find((item) => item.booking.id === plan.next?.bookingId);

  return (
    <div className="space-y-6">
      <EmployeeStartTiles
        locale={locale}
        websiteId={websiteId}
        plan={plan}
        open={open}
        unread={unread}
      />

      {next !== undefined && plan.next !== null && (
        <NextAppointment
          locale={locale}
          websiteId={websiteId}
          item={next}
          minutesUntil={plan.next.minutesUntil}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
        <OverviewPanel
          title={t('employee.start.today', { count: total })}
          meta={plan.today === '' ? undefined : zoned.calendarDate(plan.today)}
          link={{ href: bookingRoutes.mePlan(websiteId), label: t('employee.start.planLink') }}
          className="h-full"
        >
          <ResponsiveTable
            label={t('employee.start.todayLabel')}
            rows={plan.items}
            rowKey={({ booking }) => booking.id}
            density="compact"
            columns={[
              {
                id: 'time',
                label: t('employee.plan.columns.time'),
                width: '@xl:w-44',
                cell: ({ booking }) => (
                  <span className="font-semibold whitespace-nowrap text-copy">
                    {zoned.timeRange(booking.start, booking.end, booking.timeZone)}
                  </span>
                ),
              },
              {
                id: 'what',
                label: t('employee.plan.columns.what'),
                isTitle: true,
                cell: ({ labels }) => (
                  <BookingLabels labels={labels} unnamed={t('employee.unnamedService')} />
                ),
              },
              {
                id: 'phase',
                label: t('employee.plan.columns.state'),
                width: '@xl:w-40',
                cell: ({ phase }) => (
                  <PhaseChip phase={phase}>{t(`employee.phase.${phase}`)}</PhaseChip>
                ),
              },
            ]}
            state={{
              kind: 'ready',
              empty: (
                <BookingEmptyState
                  icon={<Calendar aria-hidden="true" />}
                  className="flex-1"
                  title={t('employee.start.emptyToday')}
                  description={t('employee.start.emptyTodayBody')}
                />
              ),
            }}
          />
        </OverviewPanel>

        <div className="space-y-6">
          <EmployeeStartActions
            locale={locale}
            websiteId={websiteId}
            matching={open === null ? null : matchingCount(open)}
          />

          <OverviewPanel
            title={t('employee.start.fresh')}
            link={{
              href: bookingRoutes.meMessages(websiteId),
              label: t('employee.start.allMessages'),
            }}
          >
            {fresh.length > 0 ? (
              fresh.map((message) => (
                <OverviewRow key={message.id}>
                  <MessageLine message={message} />
                </OverviewRow>
              ))
            ) : (
              <BookingEmptyState
                icon={<Mail aria-hidden="true" />}
                className="flex-1"
                title={t('employee.start.nothingNew')}
              />
            )}
          </OverviewPanel>
        </div>
      </div>
    </div>
  );
}
