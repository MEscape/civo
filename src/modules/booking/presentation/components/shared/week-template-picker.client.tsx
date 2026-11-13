'use client';

import { ConfirmDialog } from '@components/shared/dialog';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { weekdayId } from '../../forms/week/draft';
import { WEEK_TEMPLATE_KEYS } from '../../forms/week/templates';
import { formatRanges } from '../../forms/week/time';
import { useWeekTemplate } from '../../hooks/use-week-template';
import { WEEK_TEMPLATE_MESSAGE_KEYS } from '../../messages/message-keys';

import type { DayDto } from '../../dto/location-dto';
import type { WeekDraft } from '../../forms/week/draft';

export interface WeekTemplatePickerProps {
  readonly value: WeekDraft;
  readonly onApply: (week: DayDto[]) => void;
  readonly disabled?: boolean | undefined;
}

/**
 * Starting weeks to choose from. Choosing one asks first, in a dialog that shows day by day what it
 * would change (and, as a dialog, pushes nothing around on the page): a template never silently
 * replaces hours someone typed.
 */
export function WeekTemplatePicker({ value, onApply, disabled = false }: WeekTemplatePickerProps) {
  const t = useTranslations('booking');
  const { pending, changes, choose, apply, drop } = useWeekTemplate(value, onApply);

  const describe = (day: DayDto) =>
    day.intervals.length === 0
      ? t('hours.closed')
      : [
          formatRanges(day.intervals),
          ...(day.breaks.length === 0
            ? []
            : [t('hours.breakWord', { breaks: formatRanges(day.breaks) })]),
        ].join(', ');

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t('hours.templates.label')}
      >
        <span className="text-sm font-medium text-copy">{t('hours.templates.label')}</span>
        {WEEK_TEMPLATE_KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              choose(key);
            }}
          >
            {t(WEEK_TEMPLATE_MESSAGE_KEYS[key])}
          </Button>
        ))}
        <span className="text-xs text-copy-muted">{t('hours.templates.hint')}</span>
      </div>

      <ConfirmDialog
        open={pending !== null}
        confirmVariant="default"
        size="lg"
        title={
          pending === null
            ? ''
            : t('hours.preview.title', { template: t(WEEK_TEMPLATE_MESSAGE_KEYS[pending]) })
        }
        description={changes.length === 0 ? undefined : t('hours.preview.body')}
        confirmLabel={t('hours.preview.apply')}
        cancelLabel={t('hours.preview.cancel')}
        isConfirmDisabled={changes.length === 0}
        onConfirm={apply}
        onCancel={drop}
      >
        {changes.length === 0 ? (
          <p className="text-sm text-copy-muted">{t('hours.preview.unchanged')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-token border border-border text-sm">
            {changes.map(({ weekday, before, after }) => (
              <li key={weekday}>
                {/* Read as one sentence; drawn as a day, what it was and what it becomes. */}
                <span className="sr-only">
                  {t('hours.preview.change', {
                    day: t(`weekdays.long.${weekdayId(weekday)}`),
                    before: describe(before),
                    after: describe(after),
                  })}
                </span>
                <span
                  aria-hidden="true"
                  className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:gap-3"
                >
                  <span className="font-medium text-copy sm:w-24 sm:shrink-0">
                    {t(`weekdays.long.${weekdayId(weekday)}`)}
                  </span>
                  <span className="text-copy-muted">
                    {describe(before)} →{' '}
                    <span className="font-medium text-copy">{describe(after)}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  );
}
