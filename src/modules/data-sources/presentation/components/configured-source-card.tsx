'use client';

import { useState, useTransition } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { Check, Info, RefreshCw, Trash2 } from '@components/ui/icons';

import { useNow, useTranslations, useAppFormatters } from '@i18n/client';

import { testDataSourceConnectionAction } from '../actions/test-data-source-connection-action';
import { KIND_MESSAGE_KEYS, MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import { DataSourceStatusBadge } from './data-source-status-badge';
import { DatasetManagementPanel, connectionNoticeId } from './dataset-management-panel';
import { useDeleteData } from './delete-data-context';
import { DeleteWhenUnusedDialog } from './delete-when-unused-dialog';

import type { DatasetUsage } from './dataset-management-item';
import type { DataSourceDto } from '../dto/data-source-dto';

export interface ConfiguredSourceCardProps {
  readonly source: DataSourceDto;
  /** Which pages use each dataset; `null` when unknown. */
  readonly usage: DatasetUsage;
  /** The one dataset whose mapping is open on the screen. */
  readonly expandedDatasetId: string | null;
  readonly onExpandDataset: (datasetId: string | null) => void;
  readonly onMappingDirtyChange: (isDirty: boolean) => void;
}

type TestMessage =
  { readonly kind: 'healthy' } | { readonly kind: 'failed'; readonly code: string };

/** What is known about the connection: the fresh test result, else the stored error, else a nudge to test. */
function ConnectionNotice({
  source,
  testMessage,
}: {
  readonly source: DataSourceDto;
  readonly testMessage: TestMessage | null;
}) {
  const t = useTranslations('dataSources');
  const errorBox = 'rounded-token border border-danger-border bg-danger-subtle px-3 py-2';

  let notice = null;
  if (testMessage?.kind === 'healthy') {
    notice = (
      <p className="flex items-center gap-2 rounded-token border border-success-border bg-success-subtle px-3 py-2 text-sm text-copy">
        <Check className="size-4 text-success" aria-hidden="true" />
        {t('sourceCard.testHealthy')}
      </p>
    );
  } else if (testMessage?.kind === 'failed') {
    notice = (
      <div className={errorBox}>
        <FieldMessage
          id={`${source.id}-test-error`}
          message={t(messageKeyForCode(testMessage.code), MESSAGE_PARAMS)}
          className="text-sm text-danger"
        />
      </div>
    );
  } else if (source.status === 'ERROR' && source.lastErrorCode) {
    notice = (
      <div className={errorBox}>
        <FieldMessage
          id={`${source.id}-last-error`}
          message={t(messageKeyForCode(source.lastErrorCode), MESSAGE_PARAMS)}
          className="text-sm text-danger"
        />
        <p className="mt-1 text-xs text-copy">
          {source.datasets.length > 0
            ? t('sourceCard.failedWithDatasets')
            : t('sourceCard.failedHint')}
        </p>
      </div>
    );
  } else if (source.status === 'UNKNOWN') {
    notice = (
      <p className="flex gap-2 text-sm text-copy-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
        {t('sourceCard.untestedHint')}
      </p>
    );
  }

  return (
    <div id={connectionNoticeId(source.id)} aria-live="polite">
      {notice}
    </div>
  );
}

/**
 * One connected source: where it reads from, whether it was reachable, and
 * its datasets. What to do next is said where it is done: an untested source
 * suggests the test beside its button.
 */
export function ConfiguredSourceCard({
  source,
  usage,
  expandedDatasetId,
  onExpandDataset,
  onMappingDirtyChange,
}: ConfiguredSourceCardProps) {
  const t = useTranslations('dataSources');

  const format = useAppFormatters();
  // `useNow` is hydration-safe, unlike `new Date()` in render.
  const now = useNow();
  const [isPending, startTransition] = useTransition();
  const [testMessage, setTestMessage] = useState<TestMessage | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteData = useDeleteData();
  const [deleteErrorCode, setDeleteErrorCode] = useState<string | undefined>(undefined);

  function handleTestConnection() {
    setTestMessage(null);
    startTransition(async () => {
      const result = await testDataSourceConnectionAction(source.id);
      if (!result.ok) {
        setTestMessage({ kind: 'failed', code: result.error.code });
      } else {
        const { outcome } = result.data;
        setTestMessage(
          outcome.isHealthy ? { kind: 'healthy' } : { kind: 'failed', code: outcome.errorCode },
        );
      }
    });
  }

  function handleDelete() {
    setDeleteErrorCode(undefined);
    startTransition(async () => {
      const result = await deleteData({ kind: 'source', id: source.id });
      setIsConfirmingDelete(false);
      if (!result.ok) {
        setDeleteErrorCode(result.error.code);
      }
    });
  }

  const isUntested = source.status === 'UNKNOWN' && testMessage === null;

  return (
    <article aria-labelledby={`${source.id}-name`} className="space-y-4 px-4 py-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`${source.id}-name`} className="text-sm font-semibold text-copy">
              {source.name}
            </h3>
            <DataSourceStatusBadge status={source.status} />
          </div>
          <p className="truncate font-mono text-xs text-copy-muted">
            {source.endpoint ?? t('sourceCard.unknownEndpoint')}
          </p>
          <p className="text-xs text-copy-muted">
            {t(KIND_MESSAGE_KEYS[source.kind])} · {t('sourceCard.lastChecked')}{' '}
            {source.lastCheckedAt
              ? format.relativeTime(source.lastCheckedAt, now)
              : t('sourceCard.never')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={isUntested ? 'default' : 'outline'}
            size="sm"
            onClick={handleTestConnection}
            disabled={isPending}
          >
            <RefreshCw
              className={
                isPending ? 'size-3.5 animate-spin motion-reduce:animate-none' : 'size-3.5'
              }
              aria-hidden="true"
            />
            {isPending ? t('sourceCard.testing') : t('sourceCard.test')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsConfirmingDelete(true);
            }}
            disabled={isPending}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('sourceCard.remove')}
          </Button>
        </div>
      </header>

      <div className="space-y-4">
        <ConnectionNotice source={source} testMessage={testMessage} />

        <FieldMessage
          id={`${source.id}-delete-error`}
          message={
            deleteErrorCode ? t(messageKeyForCode(deleteErrorCode), MESSAGE_PARAMS) : undefined
          }
          className="text-sm"
        />

        <DatasetManagementPanel
          dataSource={source}
          usage={usage}
          expandedId={expandedDatasetId}
          onExpand={onExpandDataset}
          onMappingDirtyChange={onMappingDirtyChange}
        />
      </div>

      <DeleteWhenUnusedDialog
        open={isConfirmingDelete}
        name={source.name}
        usedOn={
          usage === null ? null : source.datasets.flatMap((dataset) => usage[dataset.id] ?? [])
        }
        title={t('sourceCard.deleteTitle', { name: source.name })}
        description={t('sourceCard.confirmDelete')}
        confirmLabel={t('sourceCard.remove')}
        isPending={isPending}
        onDelete={handleDelete}
        onClose={() => {
          setIsConfirmingDelete(false);
        }}
      />
    </article>
  );
}
