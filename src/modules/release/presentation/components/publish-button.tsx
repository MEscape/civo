'use client';

import { useId, useState, useTransition } from 'react';

import { ConfirmDialog } from '@components/shared/confirm-dialog';
import { FieldMessage } from '@components/shared/field-message';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';
import { noop } from '@lib/utils';

import { RELEASE_NOTE_MAX_LENGTH } from '../../application/contracts/release-constraints';
import { publishReleaseAction } from '../actions/publish-release-action';
import { messageKeyForCode } from '../messages/message-keys';

import { CHANGE_KIND_KEYS, CHANGE_KIND_VARIANTS } from './change-kinds';
import { PagePathLabel } from './page-path-label';

import type { PublicationStatusView } from '../../application/contracts/release-views';

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
  readonly variant?: 'default' | 'outline';
}

type Translator = ReturnType<typeof useTranslations<'release'>>;

/** What the question says is about to happen. */
function describe(draft: PublishButtonProps['draft'], isFirst: boolean, t: Translator): string {
  if (draft.pageChangeCount === 0) {
    return t('publish.settingsOnly');
  }
  return isFirst ? t('publish.first') : t('publish.pages', { count: draft.pageChangeCount });
}

function ChangeList({ draft }: { readonly draft: PublishButtonProps['draft'] }) {
  const t = useTranslations('release');
  const hidden = draft.pageChangeCount - draft.pageChanges.length;

  return (
    <ul className="divide-y divide-border rounded-token border border-border">
      {draft.pageChanges.map((change) => (
        <li key={change.path} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            <span className="font-medium text-copy">{change.title}</span>
            {change.path !== '' && (
              <span className="ml-2 text-xs text-copy-muted">
                <PagePathLabel path={change.path} />
              </span>
            )}
          </span>
          <Badge variant={CHANGE_KIND_VARIANTS[change.kind]} className="shrink-0">
            {t(CHANGE_KIND_KEYS[change.kind])}
          </Badge>
        </li>
      ))}
      {hidden > 0 && (
        <li className="px-3 py-2 text-xs text-copy-muted">
          {t('publication.morePages', { count: hidden })}
        </li>
      )}
    </ul>
  );
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
  variant = 'default',
}: PublishButtonProps) {
  const t = useTranslations('release');
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [publishedNumber, setPublishedNumber] = useState<number | null>(null);

  function handleConfirm() {
    setErrorCode(null);
    startTransition(async () => {
      const result = await publishReleaseAction({ websiteId, note });
      if (!result.ok) {
        setErrorCode(applyActionError(result.error, noop));
        return;
      }
      setPublishedNumber(result.data.releaseNumber);
      setNote('');
      setIsOpen(false);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end" aria-busy={isPending}>
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={disabled}
        onClick={() => {
          setPublishedNumber(null);
          setIsOpen(true);
        }}
      >
        {label ?? t('publish.review')}
      </Button>
      {publishedNumber !== null && (
        <p role="status" className="text-xs text-success">
          {t('history.published', { number: publishedNumber })}
        </p>
      )}

      <ConfirmDialog
        open={isOpen}
        size="lg"
        confirmVariant="default"
        isPending={isPending}
        title={t('publish.title')}
        description={describe(draft, isFirst, t)}
        confirmLabel={
          isPending ? t('history.publishing') : t('publish.confirm', { number: nextNumber })
        }
        cancelLabel={t('publish.cancel')}
        onConfirm={handleConfirm}
        onCancel={() => {
          setErrorCode(null);
          setIsOpen(false);
        }}
      >
        <div className="space-y-4">
          {draft.pageChanges.length > 0 && <ChangeList draft={draft} />}
          {!isFirst && (draft.websiteChanged || draft.themeChanged) && (
            <ul className="space-y-0.5 text-sm text-copy-muted">
              {draft.websiteChanged && <li>{t('publication.websiteChanged')}</li>}
              {draft.themeChanged && <li>{t('publication.themeChanged')}</li>}
            </ul>
          )}

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
                setNote(event.target.value);
              }}
            />
            <p id={`${id}-note-hint`} className="text-xs text-copy-muted">
              {t('publish.noteHint', { count: note.length, max: RELEASE_NOTE_MAX_LENGTH })}
            </p>
          </div>

          <p className="border-l-2 border-success pl-3 text-sm text-copy">{t('publish.info')}</p>

          <FieldMessage
            id={`${id}-error`}
            message={errorCode ? t(messageKeyForCode(errorCode)) : undefined}
            className="rounded-token border border-danger px-3 py-2"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
