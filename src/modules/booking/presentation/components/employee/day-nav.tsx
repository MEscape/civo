import { ChevronRight } from '@components/icons/icons';
import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

import { shiftDay } from '../../forms/day-plan';
import { bookingRoutes } from '../../routes';
import { DateField } from '../shared/date-field.client';

export interface DayNavProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The day shown and the employee's today, `YYYY-MM-DD`. */
  readonly date: string;
  readonly today: string;
}

/** The step back, today, the step on: the calendar's controls, so a day of the plan moves like a week of the calendar. The day lives in the address. */
export async function DayNav({ locale, websiteId, date, today }: DayNavProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const link = buttonVariants({ variant: 'outline', size: 'sm' });
  const to = (day: string) => bookingRoutes.mePlan(websiteId, day);

  return (
    <nav aria-label={t('employee.plan.nav.label')} className="flex items-center gap-1">
      <Link
        href={to(shiftDay(date, -1))}
        className={cn(link, 'px-2')}
        aria-label={t('employee.plan.nav.previous')}
      >
        <ChevronRight aria-hidden="true" className="size-4 -scale-x-100 rtl:scale-x-100" />
      </Link>
      <Link
        href={to(today)}
        aria-current={date === today ? 'date' : undefined}
        className={buttonVariants({ variant: date === today ? 'default' : 'outline', size: 'sm' })}
      >
        {t('employee.plan.nav.today')}
      </Link>
      <Link
        href={to(shiftDay(date, 1))}
        className={cn(link, 'px-2')}
        aria-label={t('employee.plan.nav.next')}
      >
        <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </Link>
    </nav>
  );
}

/** Any day of the plan, as an address: the date field and the button that shows it, in the strip under the panel's header. */
export async function DayPicker({ locale, websiteId, date }: Omit<DayNavProps, 'today'>) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <form
      method="get"
      action={bookingRoutes.mePlan(websiteId)}
      className="flex items-end gap-2 border-b border-border px-4 py-3"
    >
      <DateField
        id="plan-date"
        name="date"
        label={t('employee.plan.nav.pick')}
        defaultValue={date}
      />
      <Button type="submit" variant="outline" className="h-9">
        {t('employee.plan.nav.show')}
      </Button>
    </form>
  );
}
