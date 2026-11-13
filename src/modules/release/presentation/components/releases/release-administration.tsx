import { Suspense } from 'react';

import { I18nProvider } from '@components/providers/i18n-provider';
import {
  ReleaseHistorySkeleton,
  ReleaseUpdatesSkeleton,
} from '@components/skeletons/releases-page-skeleton';

import type { Locale } from '@i18n';

import { getReleaseScreenQueries } from '../../../composition';
import { loadReleaseAdministration } from '../../loaders/load-release-administration';
import { releaseRoutes } from '../../routes';
import { releaseListParamsSchema } from '../../schemas/release-list-params-schema';
import { ComponentUpdates } from '../updates/component-updates';

import { ReleaseHistoryTable } from './release-history-table';
import { ReleaseTabs, ReleaseTabsWithCount } from './release-tabs';

import type { ReleaseListParams } from '../../schemas/release-list-params-schema';

export interface ReleaseAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  /** What the actor may do. Controls they cannot use are not drawn; the server still authorizes. */
  readonly mayRollback: boolean;
  readonly mayRun: boolean;
  readonly mayEditPages?: boolean;
}

async function ReleaseContent({
  locale,
  websiteId,
  params,
  mayRollback,
  mayRun,
  mayEditPages = false,
}: Omit<ReleaseAdministrationProps, 'searchParams'> & { readonly params: ReleaseListParams }) {
  const view = await loadReleaseAdministration({
    websiteId,
    params,
    queries: getReleaseScreenQueries(),
  });
  const routeAt = view.kind === 'updates' ? releaseRoutes.updates : releaseRoutes.releasesAt;
  const hrefFor = (page: number) => routeAt(websiteId, { page, pageSize: view.history.pageSize });

  return view.kind === 'releases' ? (
    <ReleaseHistoryTable
      locale={locale}
      websiteId={websiteId}
      history={view.history}
      authors={view.authors}
      mayRollback={mayRollback}
      hrefFor={hrefFor}
    />
  ) : (
    <ComponentUpdates
      locale={locale}
      websiteId={websiteId}
      history={view.history}
      status={view.status}
      mayRun={mayRun}
      mayEditPages={mayEditPages}
      hrefFor={hrefFor}
    />
  );
}

/**
 * The release screen: the history of releases, or the component updates of the live website,
 * as two address-backed tabs. The tabs and the content stream independently; neither holds
 * back the other.
 */
export function ReleaseAdministration({ searchParams, ...props }: ReleaseAdministrationProps) {
  const { locale, websiteId } = props;
  const params = releaseListParamsSchema.parse(searchParams);
  const { tab } = params;

  return (
    <I18nProvider locale={locale} namespaces={['release']}>
      <div className="space-y-6">
        <Suspense fallback={<ReleaseTabs locale={locale} websiteId={websiteId} tab={tab} />}>
          <ReleaseTabsWithCount locale={locale} websiteId={websiteId} tab={tab} />
        </Suspense>
        <Suspense
          key={tab}
          fallback={tab === 'releases' ? <ReleaseHistorySkeleton /> : <ReleaseUpdatesSkeleton />}
        >
          <ReleaseContent {...props} params={params} />
        </Suspense>
      </div>
    </I18nProvider>
  );
}
