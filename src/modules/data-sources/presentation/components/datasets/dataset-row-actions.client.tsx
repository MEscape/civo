'use client';

import { Link2, Pencil, Trash2 } from '@components/icons/icons';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useDeleteDataFlow } from '../../hooks/use-delete-data-flow';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { dataSourceRoutes } from '../../routes';
import { DeleteWhenUnusedDialog } from '../shared/delete-when-unused-dialog';

import type { DataSourceCapabilities } from '../../dto/data-source-capabilities-dto';
import type { DatasetDto } from '../../dto/dataset-dto';
import type { DatasetUse } from '../../dto/dataset-usage-dto';
import type { DeleteDataAction } from '../shared/delete-data';

interface DatasetRowActionsProps {
  readonly dataset: DatasetDto;
  readonly capabilities: DataSourceCapabilities;
  /** The pages showing this dataset; `null` when that is unknown. */
  readonly usedOn: readonly DatasetUse[] | null;
  readonly deleteData: DeleteDataAction;
}

/**
 * The ways into one dataset: its mapping (the main action while it is unmapped, as an unmapped
 * dataset cannot be used), its form, and its deletion. Nothing is edited in the list itself.
 */
export function DatasetRowActions({
  dataset,
  capabilities,
  usedOn,
  deleteData,
}: DatasetRowActionsProps) {
  const t = useTranslations('dataSources');
  const flow = useDeleteDataFlow({ deleteData, kind: 'dataset', id: dataset.id });
  const isMapped = dataset.mapping !== null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {capabilities.canMapDataset && (
        <Button variant={isMapped ? 'outline' : 'default'} size="sm" asChild>
          <Link
            href={dataSourceRoutes.datasetMapping(dataset.websiteId, dataset.sourceId, dataset.id)}
          >
            <Link2 className="size-3.5" aria-hidden="true" />
            {isMapped ? t('datasets.editMapping') : t('datasets.mapNow')}
          </Link>
        </Button>
      )}
      {capabilities.canUpdateDataset && (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={dataSourceRoutes.datasetEdit(dataset.websiteId, dataset.sourceId, dataset.id)}
            aria-label={t('datasets.editLabel', { name: dataset.name })}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('datasets.edit')}
          </Link>
        </Button>
      )}
      {capabilities.canDeleteDataset && (
        <Button
          type="button"
          variant="destructive-ghost"
          size="sm"
          aria-label={t('datasets.deleteLabel', { name: dataset.name })}
          onClick={flow.open}
          disabled={flow.isPending}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {t('datasets.delete')}
        </Button>
      )}
      <FieldMessage
        id={`${dataset.id}-delete-error`}
        message={flow.errorCode ? t(messageKeyForCode(flow.errorCode), MESSAGE_PARAMS) : undefined}
        className="w-full text-right text-sm"
      />
      <DeleteWhenUnusedDialog
        open={flow.isConfirming}
        name={dataset.name}
        usedOn={usedOn}
        title={t('datasets.deleteTitle', { name: dataset.name })}
        description={t('datasets.confirmDelete')}
        confirmLabel={t('datasets.delete')}
        isPending={flow.isPending}
        onDelete={flow.confirm}
        onClose={flow.close}
      />
    </div>
  );
}
