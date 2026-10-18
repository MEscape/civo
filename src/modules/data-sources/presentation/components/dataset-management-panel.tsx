'use client';

import { useState, useTransition } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { ArrowRight } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import { DatasetForm } from './dataset-form';
import { DatasetManagementItem } from './dataset-management-item';
import { useDeleteData } from './delete-data-context';
import { DeleteWhenUnusedDialog } from './delete-when-unused-dialog';

import type { DatasetUsage } from './dataset-management-item';
import type { DataSourceDto } from '../dto/data-source-dto';
import type { DatasetDto } from '../dto/dataset-dto';

export interface DatasetManagementPanelProps {
  readonly dataSource: DataSourceDto;
  /** Which pages use each dataset; `null` when unknown. */
  readonly usage: DatasetUsage;
  /** The one dataset whose mapping is open on the whole screen, owned by the screen. */
  readonly expandedId: string | null;
  readonly onExpand: (datasetId: string | null) => void;
  readonly onMappingDirtyChange: (isDirty: boolean) => void;
}

/** The pages showing a dataset: none when no page reads it, `null` when that is unknown. */
function usedOnOf(usage: DatasetUsage, datasetId: string) {
  return usage === null ? null : (usage[datasetId] ?? []);
}

function DeleteDatasetDialog({
  dataset,
  usage,
  isPending,
  onDelete,
  onClose,
}: {
  readonly dataset: DatasetDto | null;
  readonly usage: DatasetUsage;
  readonly isPending: boolean;
  readonly onDelete: (dataset: DatasetDto) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('dataSources');
  const name = dataset?.name ?? '';
  return (
    <DeleteWhenUnusedDialog
      open={dataset !== null}
      name={name}
      usedOn={dataset === null ? null : usedOnOf(usage, dataset.id)}
      title={t('datasets.deleteTitle', { name })}
      description={t('datasets.confirmDelete')}
      confirmLabel={t('datasets.delete')}
      isPending={isPending}
      onDelete={() => {
        if (dataset !== null) {
          onDelete(dataset);
        }
      }}
      onClose={onClose}
    />
  );
}

/** The notice that explains why datasets cannot be added, named by the buttons it disables. */
export function connectionNoticeId(sourceId: string): string {
  return `${sourceId}-connection`;
}

function AddDatasetButton({
  describedBy,
  isDisabled,
  onStart,
}: {
  readonly describedBy: string | undefined;
  readonly isDisabled: boolean;
  readonly onStart: () => void;
}) {
  const t = useTranslations('dataSources');
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onStart}
      disabled={isDisabled}
      aria-describedby={describedBy}
    >
      {t('datasets.add')}
    </Button>
  );
}

/** A source without datasets says what one is, since that is the step newcomers stall on. */
function FirstDataset({
  describedBy,
  isDisabled,
  onStart,
}: {
  readonly describedBy: string | undefined;
  readonly isDisabled: boolean;
  readonly onStart: () => void;
}) {
  const t = useTranslations('dataSources');
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-copy">{t('datasets.firstTitle')}</p>
        <p className="text-xs text-copy-muted">{t('datasets.firstDescription')}</p>
      </div>
      <Button size="sm" onClick={onStart} disabled={isDisabled} aria-describedby={describedBy}>
        {t('datasets.addFirst')}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * Datasets come from the server and are NOT copied into state: every change
 * goes through an action that revalidates the page, so the response already
 * carries the new list and the server stays the single source of truth.
 * A source without datasets explains what one is instead of showing an
 * empty list, since that is the step newcomers stall on.
 */
export function DatasetManagementPanel({
  dataSource,
  usage,
  expandedId,
  onExpand,
  onMappingDirtyChange,
}: DatasetManagementPanelProps) {
  const t = useTranslations('dataSources');

  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [deleting, setDeleting] = useState<DatasetDto | null>(null);
  const deleteData = useDeleteData();
  const [deleteErrorCode, setDeleteErrorCode] = useState<string | undefined>(undefined);

  const { datasets } = dataSource;
  // A dataset is read from its source, so it is added only once a test proved the source answers.
  const isConnected = dataSource.status === 'OK';
  // The source card's connection notice says why; the disabled buttons point at it.
  const describedBy = isConnected ? undefined : connectionNoticeId(dataSource.id);
  const startCreating = () => {
    setIsCreating(true);
  };

  function handleDelete(dataset: DatasetDto) {
    setDeleteErrorCode(undefined);
    startTransition(async () => {
      const result = await deleteData({ kind: 'dataset', id: dataset.id });
      setDeleting(null);
      if (!result.ok) {
        setDeleteErrorCode(result.error.code);
        return;
      }
      if (expandedId === dataset.id) {
        onExpand(null);
      }
    });
  }

  return (
    // Framed as one box under its source, so what belongs to which source is never in doubt.
    <section
      className="overflow-hidden rounded-token border border-border"
      aria-labelledby={`${dataSource.id}-datasets`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-canvas px-4 py-2">
        <h4 id={`${dataSource.id}-datasets`} className="text-xs font-semibold text-copy">
          {t('datasets.titleOf', { source: dataSource.name, count: datasets.length })}
        </h4>
        {datasets.length > 0 && (
          <AddDatasetButton
            describedBy={describedBy}
            isDisabled={isCreating || isPending || !isConnected}
            onStart={startCreating}
          />
        )}
      </div>

      <FieldMessage
        id={`${dataSource.id}-dataset-error`}
        message={
          deleteErrorCode ? t(messageKeyForCode(deleteErrorCode), MESSAGE_PARAMS) : undefined
        }
        className="px-4 pt-2 text-sm"
      />

      {datasets.length === 0 && !isCreating && (
        <FirstDataset describedBy={describedBy} isDisabled={!isConnected} onStart={startCreating} />
      )}

      {datasets.length > 0 && (
        <ul className="divide-y divide-border">
          {datasets.map((dataset) => (
            <DatasetManagementItem
              key={dataset.id}
              dataSourceId={dataSource.id}
              dataset={dataset}
              isExpanded={expandedId === dataset.id}
              usedOn={usedOnOf(usage, dataset.id)}
              onToggleExpand={() => {
                onExpand(expandedId === dataset.id ? null : dataset.id);
              }}
              onMappingDirtyChange={onMappingDirtyChange}
              onDelete={() => {
                setDeleting(dataset);
              }}
              isPending={isPending}
            />
          ))}
        </ul>
      )}

      {isCreating && (
        <div className="border-t border-border p-4">
          <DatasetForm
            dataSourceId={dataSource.id}
            onSaved={(created) => {
              setIsCreating(false);
              // The next thing to do with a new dataset is mapping its fields.
              onExpand(created.id);
            }}
            onCancel={() => {
              setIsCreating(false);
            }}
          />
        </div>
      )}

      <DeleteDatasetDialog
        dataset={deleting}
        usage={usage}
        isPending={isPending}
        onDelete={handleDelete}
        onClose={() => {
          setDeleting(null);
        }}
      />
    </section>
  );
}
