'use client';

import { ConfirmDialog, DialogNotice } from '@components/shared/dialog';
import { SelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

export interface ImpactReviewItem {
  readonly id: string;
  /** What the booking is: when it is, already formatted. */
  readonly label: string;
  /** Why the change reaches it, already translated. */
  readonly detail: string;
}

export interface ImpactChoice {
  readonly value: string;
  readonly label: string;
}

export interface ImpactReviewDialogProps {
  readonly open: boolean;
  /** How many bookings the change reaches (the list may be shorter when it was cut). */
  readonly total: number;
  /** The change in sentences, made from the data by the caller. */
  readonly changes: readonly string[];
  readonly items: readonly ImpactReviewItem[];
  /** More bookings are affected than `items` holds. */
  readonly isTruncated?: boolean;
  /**
   * What can be done with each booking. With two or more, every booking needs a choice before the
   * change can be saved; with none (or one), the bookings are listed and stay as they are.
   */
  readonly choices?: readonly ImpactChoice[];
  readonly choiceOf?: Readonly<Record<string, string>>;
  readonly onChoose?: (itemId: string, value: string) => void;
  /** What happens to the bookings if the change goes ahead, in words (nothing is cancelled for them). */
  readonly note: string;
  /** What the change does to bookings, in a sentence; by default, that it leaves them outside the opening hours. */
  readonly description?: string | undefined;
  readonly confirmLabel: string;
  readonly isPending?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * The review of what a change would do to bookings that already exist, before it is saved: the change
 * in sentences, the bookings it reaches, and what happens to them. Whoever asks supplies the
 * sentences, the bookings and what can be chosen; this draws them, counts the bookings still
 * undecided and keeps saving shut until none is. It cancels and moves nothing itself.
 */
export function ImpactReviewDialog({
  open,
  total,
  changes,
  items,
  isTruncated = false,
  choices = [],
  choiceOf = {},
  onChoose,
  note,
  description,
  confirmLabel,
  isPending = false,
  onConfirm,
  onCancel,
}: ImpactReviewDialogProps) {
  const t = useTranslations('booking');
  const mustChoose = choices.length > 1;
  const undecided = mustChoose ? items.filter(({ id }) => (choiceOf[id] ?? '') === '').length : 0;

  return (
    <ConfirmDialog
      open={open}
      size="lg"
      confirmVariant="default"
      title={
        isTruncated && total === 0 ? t('impact.titleMore') : t('impact.title', { count: total })
      }
      description={description ?? t('impact.description')}
      confirmLabel={
        undecided > 0
          ? t('impact.confirmWithOpen', {
              label: confirmLabel,
              open: t('impact.undecided', { count: undecided }),
            })
          : confirmLabel
      }
      cancelLabel={t('impact.cancel')}
      isPending={isPending}
      isConfirmDisabled={undecided > 0}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="space-y-4">
        {changes.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-copy">{t('impact.changesTitle')}</h3>
            <ul className="list-disc space-y-1 ps-5 text-sm text-copy">
              {changes.map((sentence) => (
                <li key={sentence}>{sentence}</li>
              ))}
            </ul>
          </div>
        )}

        <ul
          aria-label={t('impact.listLabel')}
          className="max-h-64 divide-y divide-border overflow-y-auto rounded-token border border-border"
        >
          {items.map((item) => (
            <li key={item.id} className="space-y-2 p-3 text-sm">
              <p className="font-medium text-copy">{item.label}</p>
              <p className="text-copy-muted">{item.detail}</p>
              {mustChoose && (
                <SelectField
                  id={`impact-choice-${item.id}`}
                  label={t('impact.choose')}
                  placeholder={t('impact.choose')}
                  options={choices}
                  value={choiceOf[item.id] ?? ''}
                  onValueChange={(value) => {
                    onChoose?.(item.id, value);
                  }}
                />
              )}
            </li>
          ))}
        </ul>

        {isTruncated && <p className="text-sm text-copy-muted">{t('impact.truncated')}</p>}

        <DialogNotice tone="warning">{note}</DialogNotice>
      </div>
    </ConfirmDialog>
  );
}
