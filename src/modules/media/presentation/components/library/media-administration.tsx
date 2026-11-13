import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getMediaQueries, mediaUploadsAvailable } from '../../../composition';
import { loadMediaAdministration } from '../../loaders/load-media-administration';
import { loadMediaUsage } from '../../loaders/load-media-usage';

import { MediaFilesPanel } from './media-files-panel';
import { MediaFirstSteps } from './media-first-steps';
import { MediaUploadButton } from './media-upload-button.client';
import { MediaUploadNotice } from './media-upload-notice.client';
import { MediaUploadScope } from './media-upload-scope.client';

import type { MediaUsageReaders } from '../../loaders/load-media-usage';

interface MediaAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The page address without its query: pages and filters are links back to it. */
  readonly pathname: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  /** What the actor may do. Controls they cannot use are not drawn; the server still authorizes. */
  readonly mayUpload: boolean;
  readonly mayDelete: boolean;
  /** Which components show each file, handed in by the route; `null` when it cannot be read. */
  readonly usage: MediaUsageReaders | null;
}

/**
 * The media screen of one website: the heading with the upload, how the upload goes, first-use
 * steps while the library is empty, and the files in a framed, searchable table. Route pages mount
 * this; the loaders own address parsing and data loading.
 */
export async function MediaAdministration({
  locale,
  websiteId,
  pathname,
  searchParams,
  mayUpload,
  mayDelete,
  usage,
}: MediaAdministrationProps) {
  const [view, uses, t] = await Promise.all([
    loadMediaAdministration({ websiteId, pathname, searchParams, queries: getMediaQueries() }),
    mayDelete ? loadMediaUsage(websiteId, locale, usage) : null,
    getTranslations({ locale, namespace: 'media' }),
  ]);
  const uploadsAvailable = mediaUploadsAvailable();
  const canUpload = mayUpload && uploadsAvailable;

  const screen = (
    <>
      <AdminPageHeader
        title={t('library.title')}
        description={t('library.description')}
        actions={canUpload ? <MediaUploadButton /> : undefined}
      />
      {!uploadsAvailable && (
        <Alert variant="warning" role="status" className="text-sm">
          {t('library.uploadsUnavailable')}
        </Alert>
      )}
      {canUpload && <MediaUploadNotice />}
      {canUpload && view.assets.total === 0 && !view.hasFilters && (
        <MediaFirstSteps locale={locale} />
      )}
      <MediaFilesPanel
        locale={locale}
        websiteId={websiteId}
        pathname={pathname}
        view={view}
        usage={uses}
        mayDelete={mayDelete}
        canUpload={canUpload}
      />
    </>
  );

  return (
    <AdminPage>
      <I18nProvider locale={locale} namespaces={['media']}>
        {canUpload ? <MediaUploadScope websiteId={websiteId}>{screen}</MediaUploadScope> : screen}
      </I18nProvider>
    </AdminPage>
  );
}
