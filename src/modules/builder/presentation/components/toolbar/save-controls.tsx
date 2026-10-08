import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { BUILDER_ERROR_CODES } from '../../../application/contracts/builder-constraints';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import {
  selectIsDirty,
  selectSaveErrorCode,
  selectSaveStatus,
} from '../../state/builder-selectors';
import { saveDraft } from '../../state/save-thunk';
import { ErrorMessage } from '../feedback/error-message';

import type { SaveStatus } from '../../state/save-reducer';

const MUTED = 'text-xs text-copy-muted';

interface SaveStatusMessageProps {
  readonly status: SaveStatus;
  readonly errorCode: string | null;
  readonly isDirty: boolean;
}

/** One message per state, in priority order: a failure beats everything, then progress, then dirtiness. */
function SaveStatusMessage({ status, errorCode, isDirty }: SaveStatusMessageProps) {
  const t = useTranslations('builder');

  if (status === 'error' && errorCode !== null) {
    return (
      <>
        <ErrorMessage code={errorCode} />
        {errorCode === BUILDER_ERROR_CODES.pageVersionConflict && (
          // A full reload is deliberate: the stale draft is discarded in favour of the stored revision.
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.reload();
            }}
          >
            {t('save.reload')}
          </Button>
        )}
      </>
    );
  }
  if (status === 'saving') {
    return <span className={MUTED}>{t('save.saving')}</span>;
  }
  if (isDirty) {
    return <span className="text-xs text-accent-copy">{t('save.unsaved')}</span>;
  }
  if (status === 'saved') {
    return <span className={MUTED}>{t('save.saved')}</span>;
  }
  return null;
}

/** Save status as a polite live region, plus the save button. */
export function SaveControls() {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const status = useBuilderSelector(selectSaveStatus);
  const errorCode = useBuilderSelector(selectSaveErrorCode);
  const isDirty = useBuilderSelector(selectIsDirty);
  const isSaving = status === 'saving';

  return (
    <>
      <div role="status" aria-live="polite" className="flex items-center gap-2">
        <SaveStatusMessage status={status} errorCode={errorCode} isDirty={isDirty} />
      </div>
      <Button size="sm" disabled={isSaving || !isDirty} onClick={() => void dispatch(saveDraft())}>
        {isSaving ? t('toolbar.saving') : t('toolbar.save')}
      </Button>
    </>
  );
}
