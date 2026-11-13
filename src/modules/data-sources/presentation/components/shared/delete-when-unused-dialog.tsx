'use client';

import { DeleteWhenUnusedDialog as SharedDeleteWhenUnusedDialog } from '@components/shared/dialog';

import { useTranslations } from '@i18n/client';

import type { DatasetUse } from '../../dto/dataset-usage-dto';

interface DeleteWhenUnusedDialogProps {
  readonly open: boolean;
  /** What is deleted: a dataset, or a source with all its datasets. */
  readonly name: string;
  /** The places showing what would be deleted; `null` when that is unknown. */
  readonly usedOn: readonly DatasetUse[] | null;
  /** The ordinary question, asked when nothing uses it. */
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly isPending: boolean;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

/**
 * Deleting data, or saying why not yet. Data that pages or saved maps still
 * read is not deleted: the live site shows an error where a dataset is
 * missing (sample data never reaches citizens), so those components and map
 * layers are switched to another dataset first. The dialog lists them, each
 * opening its editor (a component selected, or the map); the first is one
 * click away.
 */
export function DeleteWhenUnusedDialog({ name, usedOn, ...props }: DeleteWhenUnusedDialogProps) {
  const t = useTranslations('dataSources');
  // One component or map reading two datasets of a source is listed once.
  const uses =
    usedOn === null
      ? null
      : [
          ...new Map(
            usedOn
              .flatMap((use) => {
                if (use.where === 'map') {
                  return [{ href: use.href, label: use.title, detail: t('inUse.mapDetail') }];
                }
                return use.components.map((component) => ({
                  href: component.href,
                  label: component.label,
                  detail: use.title,
                }));
              })
              .map((use) => [use.href, use]),
          ).values(),
        ];
  const livePages = [
    ...new Map(
      (usedOn ?? []).filter((page) => page.where === 'live').map((page) => [page.title, page]),
    ).values(),
  ];
  return (
    <SharedDeleteWhenUnusedDialog
      {...props}
      uses={uses}
      liveHref={livePages[0]?.href}
      labels={{
        inUseTitle: t('inUse.title', { name }),
        inUseDescription: t('inUse.description', { count: uses?.length ?? 0 }),
        liveDescription: t('inUse.liveDescription', {
          pages: livePages.map((page) => page.title).join(', '),
        }),
        unknownDescription: t('inUse.unknown'),
        openFirst: t('inUse.openFirst'),
        openLive: t('inUse.openReleases'),
        close: t('inUse.close'),
      }}
    />
  );
}
