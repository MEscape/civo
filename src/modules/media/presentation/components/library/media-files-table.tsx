import { Search, UploadCloud } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { SortSpec } from '@lib/pagination';

import { mediaFileColumns } from './media-file-columns';
import { MediaUploadButton } from './media-upload-button.client';

import type { MediaSortField } from '../../../application/contracts/media-constraints';
import type { MediaAssetView } from '../../../application/contracts/media-views';
import type { MediaUses } from '../../loaders/load-media-usage';

interface MediaFilesTableProps {
  readonly websiteId: string;
  readonly assets: readonly MediaAssetView[];
  readonly mayDelete: boolean;
  /** Whether the actor may add a first file; the empty state then invites them to. */
  readonly canUpload: boolean;
  readonly usage: MediaUses;
  readonly sort: SortSpec<MediaSortField>;
  readonly sortHref: (field: MediaSortField) => string;
  /** The address without search and quick filter, offered when nothing matches them. */
  readonly resetHref: string | null;
}

/** One page of a website's files in the shared responsive table, with a preview in the first column. */
export async function MediaFilesTable({
  websiteId,
  assets,
  mayDelete,
  canUpload,
  usage,
  sort,
  sortHref,
  resetHref,
}: MediaFilesTableProps) {
  const [t, format] = await Promise.all([getTranslations('media'), getAppFormatters()]);

  return (
    <ResponsiveTable
      label={t('library.listLabel')}
      rows={assets}
      rowKey={(asset) => asset.id}
      density="standard"
      columns={mediaFileColumns({ t, format, websiteId, mayDelete, usage, sort, sortHref })}
      state={{
        kind: 'ready',
        empty:
          resetHref === null ? (
            <EmptyState
              className="py-10"
              icon={<UploadCloud className="size-6" aria-hidden="true" />}
              title={t('library.emptyTitle')}
              description={canUpload ? t('library.emptyUpload') : undefined}
              action={canUpload ? <MediaUploadButton /> : undefined}
            />
          ) : (
            <EmptyState
              className="py-10"
              icon={<Search className="size-6" aria-hidden="true" />}
              title={t('library.noMatchTitle')}
              description={t('library.noMatchDescription')}
              action={
                <Link href={resetHref} className={buttonVariants({ variant: 'outline' })}>
                  {t('library.filters.reset')}
                </Link>
              }
            />
          ),
      }}
    />
  );
}
