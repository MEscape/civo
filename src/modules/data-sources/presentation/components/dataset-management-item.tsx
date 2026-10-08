'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { CANONICAL_KIND_MESSAGE_KEYS } from '../messages/message-keys';

import { DataSourceMappingPanel } from './data-source-mapping-panel';
import { DatasetForm } from './dataset-form';

import type { DatasetDto } from '../dto/dataset-dto';

export interface DatasetManagementItemProps {
  readonly dataSourceId: string;
  readonly dataset: DatasetDto;
  readonly isExpanded: boolean;
  readonly onToggleExpand: () => void;
  readonly onDelete: (datasetId: string) => void;
  readonly isPending: boolean;
}

export function DatasetManagementItem({
  dataSourceId,
  dataset,
  isExpanded,
  onToggleExpand,
  onDelete,
  isPending,
}: DatasetManagementItemProps) {
  const t = useTranslations('dataSources');
  const [isEditing, setIsEditing] = useState(false);
  const panelId = `mapping-${dataset.id}`;

  if (isEditing) {
    return (
      <li className="rounded-token border border-border bg-surface p-4">
        <DatasetForm
          dataSourceId={dataSourceId}
          dataset={dataset}
          onSaved={() => {
            setIsEditing(false);
          }}
          onCancel={() => {
            setIsEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="space-y-4 rounded-token border border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-copy">{dataset.name}</h4>
          <p className="text-sm text-copy-muted">
            {t('datasets.kind', {
              kind: t(CANONICAL_KIND_MESSAGE_KEYS[dataset.canonicalKind]),
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditing(true);
            }}
            disabled={isPending}
          >
            {t('datasets.edit')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={onToggleExpand}
          >
            {isExpanded ? t('datasets.hideMapping') : t('datasets.editMapping')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDelete(dataset.id);
            }}
            disabled={isPending}
          >
            {t('datasets.delete')}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div id={panelId} className="border-t border-border pt-4">
          <DataSourceMappingPanel
            datasetId={dataset.id}
            canonicalKind={dataset.canonicalKind}
            existingMapping={dataset.mapping}
          />
        </div>
      )}
    </li>
  );
}
