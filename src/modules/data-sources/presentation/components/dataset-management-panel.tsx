'use client';

import { useState, useTransition } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { deleteDatasetAction } from '../actions/delete-dataset-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import { DatasetForm } from './dataset-form';
import { DatasetManagementItem } from './dataset-management-item';

import type { DataSourceDto } from '../dto/data-source-dto';

export interface DatasetManagementPanelProps {
  readonly dataSource: DataSourceDto;
}

/**
 * Datasets come from the server and are NOT copied into state: after a
 * change `router.refresh()` re-renders with the new list, so the server
 * stays the single source of truth.
 */
export function DatasetManagementPanel({ dataSource }: DatasetManagementPanelProps) {
  const t = useTranslations('dataSources');

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteErrorCode, setDeleteErrorCode] = useState<string | undefined>(undefined);

  const { datasets } = dataSource;

  function handleDelete(datasetId: string) {
    if (!window.confirm(t('datasets.confirmDelete'))) {
      return;
    }
    setDeleteErrorCode(undefined);

    startTransition(async () => {
      const result = await deleteDatasetAction(datasetId);
      if (!result.ok) {
        setDeleteErrorCode(result.error.code);
        return;
      }
      if (expandedId === datasetId) {
        setExpandedId(null);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-copy">{t('datasets.title')}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsCreating(true);
          }}
          disabled={isCreating || isPending}
        >
          {t('datasets.add')}
        </Button>
      </div>

      <FieldMessage
        id={`${dataSource.id}-dataset-error`}
        message={
          deleteErrorCode ? t(messageKeyForCode(deleteErrorCode), MESSAGE_PARAMS) : undefined
        }
        className="text-sm"
      />

      {datasets.length === 0 && !isCreating ? (
        <EmptyState variant="outlined" className="py-4" title={t('datasets.empty')} />
      ) : (
        <ul className="space-y-4">
          {datasets.map((dataset) => (
            <DatasetManagementItem
              key={dataset.id}
              dataSourceId={dataSource.id}
              dataset={dataset}
              isExpanded={expandedId === dataset.id}
              onToggleExpand={() => {
                setExpandedId(expandedId === dataset.id ? null : dataset.id);
              }}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))}
        </ul>
      )}

      {isCreating && (
        <div className="rounded-token border border-border bg-surface p-4">
          <DatasetForm
            dataSourceId={dataSource.id}
            onSaved={(created) => {
              setIsCreating(false);
              setExpandedId(created.id);
            }}
            onCancel={() => {
              setIsCreating(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
