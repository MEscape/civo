import type { ReactNode } from 'react';

import { AdminPage } from '@components/layout/admin-page';
import { I18nProvider } from '@components/providers/i18n-provider';
import { DataPanel } from '@components/shared/data-panel';
import { LinkTabs } from '@components/shared/filter-bar';
import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getReleaseScreenQueries } from '../../../composition';
import { loadReleasePreview } from '../../loaders/load-release-preview';
import { releaseRoutes } from '../../routes';
import { PagePathLabel } from '../shared/page-path-label';

import { FidelityNotice } from './fidelity-notice';
import { PreviewHeader } from './preview-header';

import type {
  PublishedPageView,
  PublishedSnapshotView,
} from '../../../application/contracts/snapshot-views';

export interface ReleasePreviewProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly releaseId: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  /** Whether the actor may restore the release; the server still authorizes. */
  readonly mayRollback: boolean;
  /**
   * Draws one frozen page the way the public site draws it, or `null` when its stored form can no
   * longer be read. Rendering belongs to the modules that know pages and components; the
   * application's composition boundary hands it in, so this module imports neither.
   */
  readonly renderPage: (page: PublishedPageView, snapshot: PublishedSnapshotView) => ReactNode;
}

/**
 * One release's pages as they were frozen, for looking at an earlier state or at what is live.
 * It is read through the authorized website, so another website's release is "not found", and
 * nothing here can be edited. A release that today's components cannot draw as it was says so,
 * and a page whose stored form cannot be read says that, instead of failing.
 */
export async function ReleasePreview({
  locale,
  websiteId,
  releaseId,
  searchParams,
  mayRollback,
  renderPage,
}: ReleasePreviewProps) {
  const [t, screen] = await Promise.all([
    getTranslations({ locale, namespace: 'release' }),
    loadReleasePreview({ websiteId, releaseId, searchParams, queries: getReleaseScreenQueries() }),
  ]);
  const { page, snapshot, from } = screen;
  const frozen = renderPage(page, snapshot);

  return (
    <AdminPage>
      <I18nProvider locale={locale} namespaces={['release']}>
        <PreviewHeader
          locale={locale}
          websiteId={websiteId}
          screen={screen}
          mayRollback={mayRollback}
        />
        <FidelityNotice fidelity={screen.fidelity} />
        <div className="space-y-4">
          <LinkTabs
            label={t('preview.pagesLabel')}
            activeKey={page.path}
            tabs={snapshot.pages.map((candidate) => ({
              key: candidate.path,
              label: candidate.path === '' ? t('preview.home') : candidate.title,
              href: releaseRoutes.preview(websiteId, releaseId, { from, path: candidate.path }),
            }))}
          />
          <DataPanel
            title={page.title}
            description={t('preview.description')}
            meta={<PagePathLabel path={page.path} />}
          >
            {frozen ?? (
              <Alert variant="danger" role="status" className="m-4">
                <p className="font-heading text-base font-semibold">{t('preview.broken.title')}</p>
                <p className="mt-1 text-sm text-copy">{t('preview.broken.description')}</p>
              </Alert>
            )}
          </DataPanel>
        </div>
      </I18nProvider>
    </AdminPage>
  );
}
