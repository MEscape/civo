import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { calendarHref } from '../../forms/booking-list-href';
import { ActionMenu } from '../shared/action-menu.client';

import type { BookingNamesDto } from '../../dto/booking-dto';
import type { CalendarAddress } from '../../forms/booking-list-href';

export interface CalendarPlaceMenuProps {
  readonly locale: Locale;
  readonly base: string;
  readonly address: CalendarAddress;
  readonly names: BookingNamesDto;
}

/** The calendar's location filter as a quick choice: the one shown, and every other (or all) as an address. */
export async function CalendarPlaceMenu({ locale, base, address, names }: CalendarPlaceMenuProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const place = (locationId: string | undefined) => calendarHref(base, { ...address, locationId });
  const current = names.locations.find(({ id }) => id === address.locationId);

  return (
    <ActionMenu
      variant="outline"
      size="sm"
      align="end"
      label={current?.name ?? t('calendar.filters.locationAny')}
      options={[
        {
          title: t('calendar.filters.locationAny'),
          href: place(undefined),
          isCurrent: current === undefined,
        },
        ...names.locations.map(({ id, name }) => ({
          title: name,
          href: place(id),
          isCurrent: id === address.locationId,
        })),
      ]}
    />
  );
}
