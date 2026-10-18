import { HistoryPagination, ReleaseHistoryPanel, releaseQueries } from '@modules/release';
import { releaseRoutes, toReleaseHistoryDto } from '@modules/release/client';

import { I18nProvider } from '@components/providers/i18n-provider';

import { loadMemberNames } from '@/app/_lib/member-names';
import { orFail } from '@/app/_lib/or-fail';

import type { TabProps } from './tab-props';

export async function ReleasesTab({ websiteId, locale, access, searchParams }: TabProps) {
  const { page, pageSize } = searchParams;
  const releases = await orFail(releaseQueries.listReleases.execute(websiteId, { page, pageSize }));
  const authors = await loadMemberNames(releases.items.map((release) => release.publishedBy));

  return (
    <I18nProvider locale={locale} namespaces={['release']}>
      <ReleaseHistoryPanel
        websiteId={websiteId}
        history={toReleaseHistoryDto(releases)}
        page={releases.page}
        mayRollback={access.may('release.rollback')}
        authors={authors}
        pagination={
          releases.pageCount > 1 ? (
            <HistoryPagination
              locale={locale}
              scope="releases"
              page={releases}
              basePath={releaseRoutes.releases(websiteId)}
            />
          ) : undefined
        }
      />
    </I18nProvider>
  );
}
