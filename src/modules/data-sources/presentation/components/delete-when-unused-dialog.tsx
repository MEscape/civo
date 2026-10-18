'use client';

import { ConfirmDialog } from '@components/shared/confirm-dialog';
import { ArrowRight } from '@components/ui/icons';

import { Link, useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import type { DatasetUse } from './dataset-management-item';

export interface DeleteWhenUnusedDialogProps {
  readonly open: boolean;
  /** What is deleted: a dataset, or a source with all its datasets. */
  readonly name: string;
  /** The pages showing what would be deleted; `null` when that is unknown. */
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
 * Deleting data, or saying why not yet. Data that pages still read is not
 * deleted: the live site shows an error where a dataset is missing (sample
 * data never reaches citizens), so those components are switched to another
 * dataset first. The dialog lists them, each opening the editor with that
 * component selected; the first is one click away.
 */
export function DeleteWhenUnusedDialog({
  open,
  name,
  usedOn,
  title,
  description,
  confirmLabel,
  isPending,
  onDelete,
  onClose,
}: DeleteWhenUnusedDialogProps) {
  const t = useTranslations('dataSources');
  const router = useRouter();
  // One component reading two datasets of a source is listed once.
  const uses = [
    ...new Map(
      (usedOn ?? [])
        .filter((page) => !page.isLive)
        .flatMap((page) => page.components.map((component) => ({ ...component, page: page.title })))
        .map((use) => [use.href, use]),
    ).values(),
  ];
  const livePages = [
    ...new Map(
      (usedOn ?? []).filter((page) => page.isLive).map((page) => [page.title, page]),
    ).values(),
  ];
  // The way out: the first component to switch, or else publishing what was already switched.
  const next = uses[0]?.href ?? livePages[0]?.href;

  if (next === undefined) {
    return (
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={t('inUse.close')}
        isPending={isPending}
        onConfirm={onDelete}
        onCancel={onClose}
      />
    );
  }

  return (
    <ConfirmDialog
      open={open}
      size="lg"
      confirmVariant="default"
      title={t('inUse.title', { name })}
      description={
        uses.length > 0
          ? t('inUse.description', { count: uses.length })
          : t('inUse.liveDescription', { pages: livePages.map((page) => page.title).join(', ') })
      }
      confirmLabel={uses.length > 0 ? t('inUse.openFirst') : t('inUse.openReleases')}
      cancelLabel={t('inUse.close')}
      onConfirm={() => {
        onClose();
        router.push(next);
      }}
      onCancel={onClose}
    >
      {uses.length > 0 && (
        <ul className="divide-y divide-border rounded-token border border-border">
          {uses.map((use) => (
            <li key={use.href}>
              <Link
                href={use.href}
                onClick={onClose}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-copy">{use.label}</span>
                  <span className="ml-2 text-xs text-copy-muted">{use.page}</span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-copy-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
}
