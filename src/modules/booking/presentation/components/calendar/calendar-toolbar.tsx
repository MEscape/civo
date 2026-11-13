import { ChevronRight } from '@components/icons/icons';
import { LinkTabs } from '@components/shared/filter-bar';
import { buttonVariants } from '@components/ui/button';

import type { Locale } from '@i18n';
import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

import { calendarHref } from '../../forms/booking-list-href';
import { shiftAnchor } from '../../forms/calendar-range';
import { CALENDAR_VIEWS } from '../../schemas/parse-booking-list-input';

import type { CalendarAddress } from '../../forms/booking-list-href';

export interface CalendarToolbarProps {
  readonly locale: Locale;
  readonly base: string;
  readonly address: CalendarAddress;
  /** Today on the locations' calendar. */
  readonly today: string;
}

/**
 * What moves the calendar, in the header of its panel: the step back, today, the step on, and the view
 * (week, day, month, list). Every one is an address, so a view can be shared and works without a script.
 */
export async function CalendarToolbar({ locale, base, address, today }: CalendarToolbarProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const to = (change: Partial<CalendarAddress>) => calendarHref(base, { ...address, ...change });
  const step = (direction: -1 | 1) =>
    to({ date: shiftAnchor(address.view, address.date, direction) });
  const link = buttonVariants({ variant: 'outline', size: 'sm' });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label={t('calendar.nav.label')} className="flex items-center gap-1">
        <Link href={step(-1)} className={cn(link, 'px-2')} aria-label={t('calendar.nav.previous')}>
          <ChevronRight aria-hidden="true" className="size-4 -scale-x-100 rtl:scale-x-100" />
        </Link>
        <Link href={to({ date: today })} className={link}>
          {t('calendar.nav.today')}
        </Link>
        <Link href={step(1)} className={cn(link, 'px-2')} aria-label={t('calendar.nav.next')}>
          <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </Link>
      </nav>
      <LinkTabs
        label={t('calendar.views.label')}
        activeKey={address.view}
        tabs={CALENDAR_VIEWS.map((view) => ({
          key: view,
          label: t(`calendar.views.${view}`),
          href: to({ view }),
        }))}
      />
    </div>
  );
}
