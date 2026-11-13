import { MapPin } from '@components/icons/icons';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { comingSpells } from '../../forms/cover-spells';
import { createZonedFormat } from '../../hooks/use-zoned-format';

import type { CoverageDto } from '../../dto/team-dto';

/** How many days ahead an assignment elsewhere is announced: two weeks, today included. */
const ANNOUNCED_DAYS_AHEAD = 14;

export interface CoverNoticeProps {
  readonly locale: Locale;
  /** The days a manager sends the person to other locations. */
  readonly coverage: readonly CoverageDto[];
  /** The day it is, on the clock of the person's location (`YYYY-MM-DD`). */
  readonly today: string;
}

/**
 * Says it plainly when the person has to work at another location: where they are today, or where and
 * when they are sent in the next two weeks. It is the one thing on the page that changes where they go, so
 * it is a warning of its own and not a line in a list. Nothing is drawn when nothing is coming up.
 */
export async function CoverNotice({ locale, coverage, today }: CoverNoticeProps) {
  const coming = comingSpells(coverage, today, ANNOUNCED_DAYS_AHEAD);
  if (coming.length === 0) {
    return null;
  }
  const t = await getTranslations({ locale, namespace: 'booking' });
  const zoned = createZonedFormat(locale);
  const now = coming.find((spell) => spell.from <= today);

  return (
    <Alert variant="warning" role="status">
      <MapPin aria-hidden="true" />
      <AlertTitle>
        {now === undefined
          ? t('employee.cover.titleSoon', { location: coming[0]?.locationName ?? '' })
          : t('employee.cover.titleNow', { location: now.locationName })}
      </AlertTitle>
      <AlertDescription>
        <ul className="space-y-0.5">
          {coming.map(({ locationName, from, to }) => (
            <li key={`${locationName}-${from}`}>
              {t('employee.cover.line', {
                location: locationName,
                period:
                  from === to
                    ? zoned.calendarDate(from)
                    : t('exceptions.range', {
                        from: zoned.calendarDate(from),
                        to: zoned.calendarDate(to),
                      }),
              })}
            </li>
          ))}
        </ul>
        <p className="mt-1">{t('employee.cover.body')}</p>
      </AlertDescription>
    </Alert>
  );
}
