import { useTranslations } from '@i18n/client';

import { weekdayId } from '../forms/week/draft';
import { summarizeWeek } from '../forms/week/summary';

import type { WeekDraft } from '../forms/week/draft';

/** A week in a few lines of the current language ("Mo–Fr 08:00–17:00"), as the forms show it. */
export function useWeekSummary() {
  const t = useTranslations('booking');
  return (week: WeekDraft) =>
    summarizeWeek(week, {
      none: t('overview.hoursNone'),
      day: (index) => t(`weekdays.short.${weekdayId(index)}`),
      range: (from, to) => t('week.range', { from, to }),
      group: (days, hoursText) => t('week.group', { days, hours: hoursText }),
      withBreak: (hoursText, breaks) => t('week.withBreak', { hours: hoursText, breaks }),
      total: (hoursCount, minutes) => t('week.total', { hours: hoursCount, minutes }),
    });
}
