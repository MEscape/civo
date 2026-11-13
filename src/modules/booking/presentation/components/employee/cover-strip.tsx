import { MapPin } from '@components/icons/icons';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { createZonedFormat } from '../../hooks/use-zoned-format';
import { loadComingCover } from '../../loaders/load-employee-administration';

/** How many days ahead a coming assignment elsewhere is announced in the strip: a week. */
const STRIP_DAYS_AHEAD = 7;

export interface CoverStripProps {
  readonly locale: Locale;
  readonly websiteId: string;
}

/**
 * A thin strip under the workspace bar, on every page of the workspace, while the person is sent to work at
 * another location: where they are today, or where they will be in the next week. It is the one thing that
 * changes where someone goes in the morning, so it does not wait for them to open a page about it. The
 * detail (every spell of the next two weeks) is on the start page and the day plan (`CoverNotice`).
 * Nothing is drawn for a person who is not sent anywhere or has no calendar.
 */
export async function CoverStrip({ locale, websiteId }: CoverStripProps) {
  const cover = await loadComingCover(websiteId, getBookingQueries(), STRIP_DAYS_AHEAD);
  if (cover === null) {
    return null;
  }
  const t = await getTranslations({ locale, namespace: 'booking' });
  const zoned = createZonedFormat(locale);
  const { spell } = cover;

  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning-border bg-warning-subtle px-4 py-2 text-sm font-medium text-warning"
    >
      <MapPin className="size-4 shrink-0" aria-hidden="true" />
      {spell.from <= cover.today
        ? t('employee.cover.stripNow', {
            location: spell.locationName,
            until: zoned.calendarDate(spell.to),
          })
        : t('employee.cover.stripSoon', {
            location: spell.locationName,
            from: zoned.calendarDate(spell.from),
          })}
    </p>
  );
}
