'use client';

import { ConfirmDialog } from '@components/shared/dialog';
import { CheckboxField } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { weekdayId } from '../../forms/week/draft';
import { useCopyDay } from '../../hooks/use-copy-day';

import type { DayDto } from '../../dto/location-dto';
import type { WeekDraft } from '../../forms/week/draft';

export interface CopyDayProps {
  readonly week: WeekDraft;
  /** The day to copy from (0 is Monday). */
  readonly index: number;
  readonly idPrefix: string;
  readonly disabled: boolean;
  readonly onChange: (week: DayDto[]) => void;
}

/**
 * "Copy to other days": a button that opens a dialog, where the weekdays to write this day over are
 * ticked. Copying replaces those days, so it is asked about, in a dialog that moves nothing on the page.
 */
export function CopyDay({ week, index, idPrefix, disabled, onChange }: CopyDayProps) {
  const t = useTranslations('booking');
  const { isOpen, open, close, targets, toggle, apply } = useCopyDay(week, index, onChange);
  const name = t(`weekdays.long.${weekdayId(index)}`);

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={open}>
        {t('hours.copyTitle')}
      </Button>
      <ConfirmDialog
        open={isOpen}
        confirmVariant="default"
        title={t('hours.copyTitle')}
        description={t('hours.copyBody', { day: name })}
        confirmLabel={t('hours.copyApply')}
        cancelLabel={t('hours.preview.cancel')}
        isConfirmDisabled={targets.length === 0}
        onConfirm={apply}
        onCancel={close}
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">{t('hours.copyTitle')}</legend>
          {week.map((_day, other) =>
            other === index ? null : (
              <CheckboxField
                // eslint-disable-next-line react/no-array-index-key -- the days of a week have no ids
                key={other}
                id={`${idPrefix}-copy-${index}-${other}`}
                label={t(`weekdays.long.${weekdayId(other)}`)}
                checked={targets.includes(other)}
                onChange={(event) => {
                  toggle(other, event.target.checked);
                }}
              />
            ),
          )}
        </fieldset>
      </ConfirmDialog>
    </>
  );
}
