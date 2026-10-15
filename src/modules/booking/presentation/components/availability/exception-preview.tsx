import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';
import { weekdayOfDate } from '../../time/month-math';
import { DayBars } from '../../timeline/day-bars';
import { spansOf, subtractSpans, unionSpans, windowOf } from '../../timeline/spans';

import type { DayForm, ExceptionForm } from '../../drafts/availability-plan-form';
import type { Span } from '../../timeline/spans';

export interface ExceptionPreviewProps {
  readonly exception: ExceptionForm;
  /** The seven days the exception changes, Monday first. */
  readonly weekly: readonly DayForm[];
}

/** What a day is open: its stretches without its breaks. */
function openSpansOf(day: DayForm): Span[] {
  return subtractSpans(spansOf(day.intervals), spansOf(day.breaks));
}

function resultOf(exception: ExceptionForm, regular: readonly Span[]): Span[] {
  if (exception.kind === 'closed') {
    return [];
  }
  const own = exception.day === undefined ? [] : openSpansOf(exception.day);
  return exception.kind === 'override' ? own : unionSpans(regular, own);
}

/**
 * What one exception does, shown on its first day: the hours of that weekday
 * as they are, and as they become. It is opened on purpose, for one exception
 * at a time, so a long list stays a list.
 */
export function ExceptionPreview({ exception, weekly }: ExceptionPreviewProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');
  const weekday = weekdayOfDate(exception.from);

  if (weekday === null) {
    return <p className="text-sm text-copy-muted">{t('exceptions.previewNeedsDate')}</p>;
  }
  const regularDay = weekly[weekday - 1];
  const regular = regularDay === undefined ? [] : openSpansOf(regularDay);
  const result = resultOf(exception, regular);
  const window = windowOf([...regular, ...result]);
  const dayName = format.weekdayName(weekday, 'long');
  const isRange = exception.to !== '' && exception.to !== exception.from;

  return (
    <div className="space-y-2 rounded-token border border-border bg-canvas p-3">
      <p className="text-sm font-medium text-copy">
        {isRange
          ? t('exceptions.previewRange', {
              from: format.longDate(exception.from),
              to: format.longDate(exception.to),
            })
          : format.longDate(exception.from)}
      </p>
      <div className="space-y-1.5">
        <p className="text-xs text-copy-muted">
          {t('exceptions.previewRegular', { day: dayName })}
        </p>
        <DayBars
          spans={regular}
          window={window}
          label={
            regular.length === 0
              ? t('exceptions.previewClosedLane', { day: dayName })
              : t('exceptions.previewRegular', { day: dayName })
          }
        />
        <p className="text-xs text-copy-muted">{t('exceptions.previewResult')}</p>
        <DayBars
          spans={result}
          window={window}
          label={
            result.length === 0
              ? t('exceptions.previewClosedResult')
              : t('exceptions.previewResult')
          }
        />
      </div>
      {isRange && <p className="text-xs text-copy-muted">{t('exceptions.previewSameEveryDay')}</p>}
    </div>
  );
}
