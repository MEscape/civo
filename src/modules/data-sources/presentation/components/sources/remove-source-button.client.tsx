'use client';

import { Trash2 } from '@components/icons/icons';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useDeleteDataFlow } from '../../hooks/use-delete-data-flow';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { dataSourceRoutes } from '../../routes';
import { DeleteWhenUnusedDialog } from '../shared/delete-when-unused-dialog';

import type { DataSourceDto } from '../../dto/data-source-dto';
import type { DatasetUsage } from '../../dto/dataset-usage-dto';
import type { DeleteDataAction } from '../shared/delete-data';

interface RemoveSourceButtonProps {
  readonly source: DataSourceDto;
  /** Which pages use each dataset; `null` when unknown. */
  readonly usage: DatasetUsage;
  readonly deleteData: DeleteDataAction;
  /** `sm` in a list row, the default on the source's own page. */
  readonly size?: 'sm' | undefined;
}

/** Removes the source and all of its datasets, after saying which pages still read them. */
export function RemoveSourceButton({ source, usage, deleteData, size }: RemoveSourceButtonProps) {
  const t = useTranslations('dataSources');
  const flow = useDeleteDataFlow({
    deleteData,
    kind: 'source',
    id: source.id,
    afterDeleteHref: dataSourceRoutes.sources(source.websiteId),
  });

  return (
    <>
      <Button
        type="button"
        variant="destructive-ghost"
        {...(size === undefined ? {} : { size })}
        onClick={flow.open}
        disabled={flow.isPending}
      >
        <Trash2 className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden="true" />
        {t('sourceCard.remove')}
      </Button>
      <FieldMessage
        id={`${source.id}-delete-error`}
        message={flow.errorCode ? t(messageKeyForCode(flow.errorCode), MESSAGE_PARAMS) : undefined}
        className="w-full text-sm"
      />
      <DeleteWhenUnusedDialog
        open={flow.isConfirming}
        name={source.name}
        usedOn={
          usage === null || source.isDatasetListTruncated
            ? null
            : source.datasets.flatMap((dataset) => usage[dataset.id] ?? [])
        }
        title={t('sourceCard.deleteTitle', { name: source.name })}
        description={t('sourceCard.confirmDelete')}
        confirmLabel={t('sourceCard.remove')}
        isPending={flow.isPending}
        onDelete={flow.confirm}
        onClose={flow.close}
      />
    </>
  );
}
