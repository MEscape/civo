import { weekdayId } from '../../forms/week/draft';
import { summarizeWeek } from '../../forms/week/summary';

import type { TeamMemberSummaryDto } from '../../dto/team-dto';
import type { BookingTranslator } from '../../translation/translator';

/** A week in a few lines of the language of the page, the way the forms write it. */
export const weekLines = (t: BookingTranslator, week: TeamMemberSummaryDto['weekly']) =>
  summarizeWeek(week, {
    none: t('overview.hoursNone'),
    day: (index) => t(`weekdays.short.${weekdayId(index)}`),
    range: (from, to) => t('week.range', { from, to }),
    group: (days, hours) => t('week.group', { days, hours }),
    withBreak: (hours, breaks) => t('week.withBreak', { hours, breaks }),
    total: (hours, minutes) => t('week.total', { hours, minutes }),
  });

/** The first stretch of the week and the total ("Mon–Fri 08:00–16:00 · 40 h per week"): the rest is in the row's details. */
export const weekSummary = (lines: readonly string[]) =>
  lines.length > 2 ? [lines[0], lines.at(-1)].join(' · ') : lines.join(' · ');
