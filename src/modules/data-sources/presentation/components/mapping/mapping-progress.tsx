'use client';

import { RefreshCw } from '@components/icons/icons';
import { FieldMessage, FieldSuccess } from '@components/shared/field';
import { Alert } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import type { SerializedActionError } from '@lib/result';

import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

interface MappingProgressProps {
  /** How many assignments were proposed from the field names and are not saved yet. */
  readonly suggestedCount: number;
  /** The labels of the required target fields nothing is assigned to. */
  readonly missing: readonly string[];
  readonly preservedAssignments: number;
}

/** What the person has to do with the table: check the suggestion, fill what a component cannot do without. */
export function MappingProgress({
  suggestedCount,
  missing,
  preservedAssignments,
}: MappingProgressProps) {
  const t = useTranslations('dataSources');
  return (
    <div className="space-y-2">
      {suggestedCount > 0 && (
        <Alert variant="info" role="status">
          {t('mapping.suggested', { count: suggestedCount })}
        </Alert>
      )}
      {preservedAssignments > 0 && (
        <Alert variant="info">
          {t('mapping.preservedAssignments', { count: preservedAssignments })}
        </Alert>
      )}
      {missing.length > 0 ? (
        <Alert variant="warning" role="status">
          {t('mapping.missingRequired', { fields: missing.join(', ') })}
        </Alert>
      ) : (
        <div role="status" className="text-sm">
          <FieldSuccess>{t('mapping.requiredDone')}</FieldSuccess>
        </div>
      )}
    </div>
  );
}

interface MappingFailureProps {
  readonly id: string;
  readonly failure: SerializedActionError;
  /** The refused fields, as the server keys them, with the codes that say why. */
  readonly details: ReadonlyArray<readonly [string, readonly string[]]>;
  readonly describeKey: (key: string) => string;
}

/** What the server refused, and for each field that was refused, why: one announced message. */
export function MappingFailure({ id, failure, details, describeKey }: MappingFailureProps) {
  const t = useTranslations('dataSources');
  return (
    <FieldMessage
      id={`${id}-error`}
      className="space-y-1 text-sm"
      message={
        <>
          {t(messageKeyForCode(failure.code), MESSAGE_PARAMS)}
          {details.map(([key, codes]) => (
            <span key={key} className="block text-xs">
              {describeKey(key)}: {t(messageKeyForCode(codes[0] ?? failure.code), MESSAGE_PARAMS)}
            </span>
          ))}
        </>
      }
    />
  );
}

/** The record the saved mapping would produce from the sample, before it is saved. */
export function MappingPreview({ json }: { readonly json: string }) {
  const t = useTranslations('dataSources');
  return (
    <div className="rounded-token border border-border bg-surface p-3">
      <p className="mb-1.5 text-xs font-medium text-copy-muted">{t('mapping.previewTitle')}</p>
      <pre className="overflow-x-auto text-xs text-copy">{json}</pre>
    </div>
  );
}

interface ReloadFieldsButtonProps {
  readonly isVisible: boolean;
  readonly isPending: boolean;
  readonly onClick: () => void;
}

/** Reads the fields from the source again; only offered once there is something to refresh. */
export function ReloadFieldsButton({ isVisible, isPending, onClick }: ReloadFieldsButtonProps) {
  const t = useTranslations('dataSources');
  if (!isVisible) {
    return null;
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={isPending}>
      <RefreshCw
        className={isPending ? 'size-3.5 animate-spin motion-reduce:animate-none' : 'size-3.5'}
        aria-hidden="true"
      />
      {isPending ? t('mapping.loading') : t('mapping.reload')}
    </Button>
  );
}

/** Before the fields arrive: the panel reads them by itself, so say that it is doing so. */
export function MappingLoading({ isPending }: { readonly isPending: boolean }) {
  const t = useTranslations('dataSources');
  return (
    <p role="status" className="text-sm text-copy-muted">
      {isPending ? t('mapping.reading') : t('mapping.notLoaded')}
    </p>
  );
}
