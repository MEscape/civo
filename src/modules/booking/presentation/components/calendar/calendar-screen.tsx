import { DataPanel } from '@components/shared/data-panel';
import { Alert, AlertDescription } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { calendarHref } from '../../forms/booking-list-href';
import { periodLabel } from '../../forms/calendar-range';
import { bookingRoutes } from '../../routes';
import { BookingStateTabs } from '../bookings/booking-state-tabs';

import { CalendarBoard } from './calendar-board.client';
import { CalendarPlaceMenu } from './calendar-place-menu';
import { CalendarToolbar } from './calendar-toolbar';

import type { BookingCalendarDto, BookingNamesDto } from '../../dto/booking-dto';
import type { CalendarAddress } from '../../forms/booking-list-href';

export interface CalendarScreenProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly calendar: BookingCalendarDto;
  readonly names: BookingNamesDto;
  readonly address: CalendarAddress;
  readonly today: string;
  /** Whether to offer assigning: display only, the use cases authorize on their own. */
  readonly mayManage: boolean;
}

/**
 * The manager's calendar in the frame every list of the module has: a panel whose header carries the
 * period and what moves it, a strip with the filters (the states with the same counts as the list, and
 * the location as a quick choice), and the calendar of the period. A period with more bookings than
 * are drawn says so.
 */
export async function CalendarScreen({
  locale,
  websiteId,
  calendar,
  names,
  address,
  today,
  mayManage,
}: CalendarScreenProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    getAppFormatters(),
  ]);
  const base = bookingRoutes.bookingCalendar(websiteId);
  const { days } = calendar;
  const period = periodLabel(
    address.view,
    { anchor: address.date, from: days.from, to: days.to },
    // Noon UTC: the same calendar day in every zone the app formats in.
    (day, options) => format.date(new Date(`${day}T12:00:00Z`), options),
  );

  return (
    <DataPanel
      title={period}
      actions={<CalendarToolbar locale={locale} base={base} address={address} today={today} />}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <BookingStateTabs
          locale={locale}
          label={t('calendar.states.label')}
          counts={calendar.counts}
          active={address.state}
          hrefFor={(state) => calendarHref(base, { ...address, state: state ?? undefined })}
        />
        {names.locations.length > 1 && (
          <CalendarPlaceMenu locale={locale} base={base} address={address} names={names} />
        )}
      </div>
      {calendar.isTruncated && (
        <Alert variant="warning" role="status" className="m-4 w-auto">
          <AlertDescription>{t('calendar.truncated')}</AlertDescription>
        </Alert>
      )}
      <div className="p-2 sm:p-4">
        <CalendarBoard
          items={calendar.items}
          names={names}
          view={address.view}
          date={address.date}
          locale={locale}
          mayManage={mayManage}
          listHref={bookingRoutes.bookingList(websiteId)}
        />
      </div>
    </DataPanel>
  );
}
