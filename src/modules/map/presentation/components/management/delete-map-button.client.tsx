'use client';

import { Trash2 } from '@components/icons/icons';
import { DeleteWhenUnusedDialog } from '@components/shared/dialog';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useDeleteMap } from '../../hooks/use-delete-map';
import { messageKeyForCode } from '../../messages/message-keys';

import type { MapUse } from '../../dto/map-usage-dto';
import type { DeleteMapAction } from '../../hooks/use-delete-map';

export interface DeleteMapButtonProps {
  readonly websiteId: string;
  readonly map: { readonly id: string; readonly name: string };
  readonly deleteMap: DeleteMapAction;
  /** The error code that says a page still places the map. */
  readonly inUseCode: string;
  /** The pages placing the map; `null` when unknown. The deletion checks again either way. */
  readonly usedOn: readonly MapUse[] | null;
  /** Where to go once the map is gone; absent in the list, which re-reads itself. */
  readonly afterDeleteHref?: string | undefined;
  readonly size?: 'sm' | 'default';
}

/**
 * Deletes the map, or says why not yet: a page that still places it would show an empty block, so
 * the dialog lists each map component (and the live pages) before anything is deleted.
 */
export function DeleteMapButton({
  websiteId,
  map,
  deleteMap,
  inUseCode,
  usedOn,
  afterDeleteHref,
  size = 'default',
}: DeleteMapButtonProps) {
  const t = useTranslations('map');
  const flow = useDeleteMap({ websiteId, mapId: map.id, deleteMap, inUseCode, afterDeleteHref });
  const uses =
    usedOn === null
      ? null
      : usedOn
          .filter((page) => !page.isLive)
          .flatMap((page) =>
            page.components.map((component) => ({ ...component, detail: page.title })),
          );
  const livePages = (usedOn ?? []).filter((page) => page.isLive);
  return (
    <div className="flex flex-col items-end gap-1" aria-busy={flow.isPending}>
      <Button
        type="button"
        variant="destructive-ghost"
        size={size}
        disabled={flow.isPending}
        onClick={flow.open}
        aria-label={t('management.deleteLabel', { name: map.name })}
      >
        <Trash2 className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden="true" />
        {t('management.delete')}
      </Button>
      <FieldMessage
        id={`${map.id}-delete-error`}
        message={
          flow.errorCode === null
            ? undefined
            : t(
                flow.isInUse
                  ? 'management.deleteInUse'
                  : messageKeyForCode(flow.errorCode, 'management.deleteFailed'),
              )
        }
        className="max-w-xs text-right"
      />
      <DeleteWhenUnusedDialog
        open={flow.isConfirming}
        uses={uses}
        liveHref={livePages[0]?.href}
        title={t('management.deleteTitle', { name: map.name })}
        description={t('management.deleteDescription')}
        confirmLabel={t('management.deleteConfirm')}
        labels={{
          inUseTitle: t('management.inUseTitle', { name: map.name }),
          inUseDescription: t('management.inUseDescription', { count: uses?.length ?? 0 }),
          liveDescription: t('management.liveDescription', {
            pages: livePages.map((page) => page.title).join(', '),
          }),
          unknownDescription: t('management.usageUnknown'),
          openFirst: t('management.inUseOpenFirst'),
          openLive: t('management.openReleases'),
          close: t('management.deleteCancel'),
        }}
        isPending={flow.isPending}
        onDelete={flow.confirm}
        onClose={flow.close}
      />
    </div>
  );
}
