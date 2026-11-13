'use client';

// @unsaved-work none an optional one-line note for the new release, typed inside its review dialog

import { useId } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';
import { FieldMessage, FieldSuccess } from '@components/shared/field';
import { Button } from '@components/ui/button';
import { Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { RELEASE_NOTE_MAX_LENGTH } from '../../../application/contracts/release-constraints';
import { changeCountOf } from '../../changes/change-kinds';
import { usePublishRelease } from '../../hooks/use-publish-release';

import { ChangeList } from './publish-change-list';

import type { PublicationStatusView } from '../../../application/contracts/publication-views';

export interface PublishButtonProps {
  readonly websiteId: string;
  /** What publishing now would change; the dialog lists it. */
  readonly draft: PublicationStatusView['draft'];
  /** The number the new release gets. */
  readonly nextNumber: number;
  /** Nothing is live yet, so everything counts as new. */
  readonly isFirst: boolean;
  /** A page blocks it, or there is nothing to publish. Only guidance: the server decides. */
  readonly disabled?: boolean;
  /** What the button says; "Review & publish" when left out. */
  readonly label?: string;
  /** What it says on a narrow screen instead, where the bar has little room. */
  readonly shortLabel?: string;
  readonly variant?: 'default' | 'outline';
}

/**
 * Opens the review that comes before a publish: what goes live, an optional
 * note for the history, and the number the release will get. The result is
 * server state: the action invalidates the routes that show it, so the page
 * re-renders with the new release instead of mirroring it here.
 */
export function PublishButton({
  websiteId,
  draft,
  nextNumber,
  isFirst,
  disabled = false,
  label,
  shortLabel,
  variant = 'default',
}: PublishButtonProps) {
  const t = useTranslations('release');
  const id = useId();
  const publish = usePublishRelease(websiteId);
  const { isPending, note, errorKey, publishedNumber } = publish;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end" aria-busy={isPending}>
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={disabled || isPending}
        onClick={publish.open}
      >
        {shortLabel === undefined ? (
          (label ?? t('publish.review'))
        ) : (
          <>
            <span className="lg:hidden">{shortLabel}</span>
            <span className="hidden lg:inline">{label ?? t('publish.review')}</span>
          </>
        )}
      </Button>
      {publishedNumber !== null && (
        <div role="status" className="text-xs">
          <FieldSuccess>{t('history.published', { number: publishedNumber })}</FieldSuccess>
        </div>
      )}

      <ConfirmDialog
        open={publish.isConfirming}
        size="lg"
        confirmVariant="default"
        isPending={isPending}
        title={t('publish.title')}
        description={
          isFirst ? t('publish.first') : t('publish.changes', { count: changeCountOf(draft) })
        }
        confirmLabel={
          isPending ? t('history.publishing') : t('publish.confirm', { number: nextNumber })
        }
        cancelLabel={t('publish.cancel')}
        onConfirm={publish.confirm}
        onCancel={publish.close}
      >
        <div className="space-y-4">
          {changeCountOf(draft) > 0 && <ChangeList draft={draft} isFirst={isFirst} />}

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-note`}>{t('publish.noteLabel')}</Label>
            <Textarea
              id={`${id}-note`}
              rows={2}
              value={note}
              maxLength={RELEASE_NOTE_MAX_LENGTH}
              placeholder={t('publish.notePlaceholder')}
              aria-describedby={`${id}-note-hint`}
              onChange={(event) => {
                publish.setNote(event.target.value);
              }}
            />
            <p id={`${id}-note-hint`} className="text-xs text-copy-muted">
              {t('publish.noteHint', { count: note.length, max: RELEASE_NOTE_MAX_LENGTH })}
            </p>
          </div>

          <p className="border-l-2 border-success pl-3 text-sm text-copy">{t('publish.info')}</p>

          <FieldMessage
            id={`${id}-error`}
            message={errorKey === null ? undefined : t(errorKey)}
            className="rounded-token border border-danger px-3 py-2"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
