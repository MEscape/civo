import { Lock } from '@components/icons/icons';
import { SortLink, ariaSortOf } from '@components/shared/filter-bar';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { Badge } from '@components/ui/badge';

import type { SortSpec } from '@lib/pagination';

import { MediaThumbnail } from '../shared/media-thumbnail';

import { DeleteMediaButton } from './delete-media-button.client';
import { OpenMediaButton } from './open-media-button.client';

import type { MediaSortField } from '../../../application/contracts/media-constraints';
import type { MediaAssetView } from '../../../application/contracts/media-views';
import type { MediaUses } from '../../loaders/load-media-usage';
import type { AppFormatters, MediaTranslator } from '../../translation/translator';

interface MediaFileColumnsInput {
  readonly t: MediaTranslator;
  readonly format: AppFormatters;
  readonly websiteId: string;
  /** What the actor may do; controls they cannot use are not drawn, the server still authorizes. */
  readonly mayDelete: boolean;
  /** Which components still show each file; `null` when unknown. */
  readonly usage: MediaUses;
  readonly sort: SortSpec<MediaSortField>;
  readonly sortHref: (field: MediaSortField) => string;
}

/** `PNG`, `JPEG`: the part of the content type people recognise. */
const typeLabel = (contentType: string): string =>
  (contentType.split('/')[1] ?? contentType).toUpperCase();

/**
 * The columns of the file list: the file itself with its preview, what kind and how big it is,
 * when it arrived, and what can be done with it. Private files have no preview and say so.
 */
export function mediaFileColumns({
  t,
  format,
  websiteId,
  mayDelete,
  usage,
  sort,
  sortHref,
}: MediaFileColumnsInput): ReadonlyArray<ResponsiveColumn<MediaAssetView>> {
  return [
    {
      id: 'file',
      label: t('library.columns.file'),
      isSortable: true,
      sortDirection: ariaSortOf(sort, 'name'),
      header: (
        <SortLink
          href={sortHref('name')}
          label={t('library.columns.file')}
          direction={ariaSortOf(sort, 'name')}
        />
      ),
      cell: (asset) => (
        <div className="flex items-center gap-3">
          <MediaThumbnail src={asset.publicUrl} className="w-16" />
          <div className="min-w-0 space-y-1">
            <p className="truncate font-medium text-copy">{asset.originalFilename}</p>
            {asset.visibility === 'private' ? (
              <Badge variant="muted">
                <Lock className="mr-1 size-3" aria-hidden="true" />
                {t('library.visibility.private')}
              </Badge>
            ) : (
              <Badge variant="success">{t('library.visibility.public')}</Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'details',
      label: t('library.columns.details'),
      cell: (asset) => (
        <span className="text-sm text-copy-muted">
          {typeLabel(asset.contentType)} · {format.bytes(asset.byteSize, 1)}
        </span>
      ),
    },
    {
      id: 'uploaded',
      label: t('library.columns.uploaded'),
      isSortable: true,
      sortDirection: ariaSortOf(sort, 'uploaded'),
      header: (
        <SortLink
          href={sortHref('uploaded')}
          label={t('library.columns.uploaded')}
          direction={ariaSortOf(sort, 'uploaded')}
        />
      ),
      cell: (asset) => (
        <time dateTime={asset.createdAt.toISOString()} className="text-sm text-copy-muted">
          {format.dateTime(asset.createdAt)}
        </time>
      ),
    },
    {
      id: 'actions',
      label: t('library.columns.actions'),
      isAction: true,
      cell: (asset) => (
        <div className="flex flex-wrap justify-end gap-1">
          {asset.visibility === 'private' && (
            <OpenMediaButton
              websiteId={websiteId}
              assetId={asset.id}
              filename={asset.originalFilename}
            />
          )}
          {mayDelete && (
            <DeleteMediaButton
              websiteId={websiteId}
              assetId={asset.id}
              filename={asset.originalFilename}
              uses={usage === null ? null : (usage[asset.id] ?? [])}
            />
          )}
        </div>
      ),
    },
  ];
}
