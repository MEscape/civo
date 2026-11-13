import { Calendar } from '@components/icons/icons';
import { DataPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { breakBetween, doneCount } from '../../forms/day-plan';
import { createZonedFormat } from '../../hooks/use-zoned-format';
import { BookingEmptyState } from '../shared/booking-empty-state';

import { DayNav, DayPicker } from './day-nav';
import { DayPlanAside } from './day-plan-aside';
import { planColumns, planItemName } from './day-plan-columns';
import { DayPlanDetails } from './day-plan-details';
import { NextAppointment } from './next-appointment';

import type { DayPlanDto } from '../../dto/employee-dto';

export interface DayPlanProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly plan: DayPlanDto;
  readonly mayHandBack: boolean;
}

/**
 * One day of the employee's bookings, in the table every list of the module is, laid out as the day:
 * each appointment on a timeline (a dot for where it stands), the breaks of the working hours as
 * striped rows between them, and a row that opens to the details and what the employee can do with it.
 * Beside it how far the day is, when they work, and the tips; the table is as tall as that column.
 */
export async function DayPlan({ locale, websiteId, plan, mayHandBack }: DayPlanProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const format = createZonedFormat(locale);
  const next =
    plan.date === plan.today && plan.next !== null
      ? plan.items.find((item) => item.booking.id === plan.next?.bookingId)
      : undefined;

  return (
    <div className="space-y-6">
      {/* Mockup 06: on a phone the next appointment leads the day; the wide screen has it on the start page. */}
      {next !== undefined && plan.next !== null && (
        <NextAppointment
          className="lg:hidden"
          locale={locale}
          websiteId={websiteId}
          item={next}
          minutesUntil={plan.next.minutesUntil}
        />
      )}
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DataPanel
          className="flex flex-col"
          title={format.calendarDate(plan.date)}
          meta={t('employee.plan.summary', { count: plan.items.length })}
          actions={
            <DayNav locale={locale} websiteId={websiteId} date={plan.date} today={plan.today} />
          }
        >
          <DayPicker locale={locale} websiteId={websiteId} date={plan.date} />
          <ResponsiveTable
            label={t('employee.plan.title')}
            rows={plan.items}
            rowKey={({ booking }) => booking.id}
            columns={planColumns(t, format)}
            density="compact"
            rowProps={({ booking }) => ({ id: `booking-${booking.id}` })}
            groupHeading={(item, previous) => {
              const pause = breakBetween(plan, previous, item);
              return pause === undefined ? null : (
                <span className="flex items-center gap-2 rounded-token-sm border border-border bg-surface bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_6px)] px-3 py-1.5 font-semibold text-copy">
                  {t('employee.plan.workday.breakRow', {
                    hours: format.timeRange(pause.start, pause.end, plan.timeZone),
                  })}
                </span>
              );
            }}
            rowDetails={(item) => (
              <DayPlanDetails
                t={t}
                item={item}
                name={planItemName(t, item)}
                mayHandBack={mayHandBack}
              />
            )}
            state={{
              kind: 'ready',
              empty: (
                <BookingEmptyState
                  icon={<Calendar aria-hidden="true" />}
                  className="flex-1"
                  title={t('employee.plan.empty.title')}
                  description={t('employee.plan.empty.description')}
                />
              ),
            }}
          />
        </DataPanel>
        <DayPlanAside t={t} format={format} plan={plan} done={doneCount(plan.items)} />
      </div>
    </div>
  );
}
