import { Children, Suspense } from 'react';
import type { ReactNode } from 'react';

import { AdminPage } from '@components/layout/admin-page';
import { OverviewTiles } from '@components/shared/data-panel';
import {
  OverviewBlockSkeleton,
  OverviewTileSkeleton,
} from '@components/skeletons/website-overview-skeleton';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { publicEnv } from '@lib/config';
import { orNotFound } from '@lib/errors/or-not-found';

import { loadWebsite } from '../../../composition';
import { WebsiteAboutCard } from '../website-about-card';

import { WebsiteOverviewHeader } from './website-overview-header';

interface WebsiteOverviewProps {
  readonly websiteId: string;
  readonly locale: Locale;
  readonly isLive: boolean | null;
  readonly editHref: string | null;
  readonly publicSiteHref: (slug: string) => string;
  /** The application boundary supplies independently authorized capabilities from their owning modules. */
  readonly sections: {
    readonly publication: ReactNode;
    /** One tile per capability the actor may see: its figure and the way in. */
    readonly metrics: readonly ReactNode[];
    readonly onboarding: ReactNode;
    readonly activity: ReactNode;
    readonly releases: ReactNode;
  };
}

/** Each capability streams independently, so a slow read never holds back the others. */
function OverviewBlock({ children }: { readonly children: ReactNode }) {
  return <Suspense fallback={<OverviewBlockSkeleton />}>{children}</Suspense>;
}

/**
 * Website-owned framing and facts; foreign capabilities stay composed at the application boundary.
 * Top to bottom by how much a person needs it: whether visitors see the latest state, the first steps
 * of a new website, the figures of every area as one row of tiles, then what happened lately beside
 * the website's own facts and what was published.
 */
export async function WebsiteOverview({
  websiteId,
  locale,
  isLive,
  editHref,
  publicSiteHref,
  sections,
}: WebsiteOverviewProps) {
  const [website, t] = await Promise.all([
    orNotFound(loadWebsite(websiteId)),
    getTranslations({ locale, namespace: 'website' }),
  ]);
  const publicHref = isLive === true ? publicSiteHref(website.slug) : null;
  const publicUrl =
    publicHref === null
      ? null
      : new URL(`/${locale}${publicHref}`, publicEnv.NEXT_PUBLIC_APP_URL).href;
  const hasActivity = sections.activity !== null;
  return (
    <AdminPage>
      <WebsiteOverviewHeader
        website={website}
        locale={locale}
        isLive={isLive}
        publicHref={publicHref}
        editHref={editHref}
      />
      {sections.publication}
      {/* The first steps of a new website lead the page across its whole width; done, they leave no gap. */}
      <Suspense fallback={null}>{sections.onboarding}</Suspense>
      {sections.metrics.length > 0 && (
        <section aria-labelledby="overview-metrics">
          <h2 id="overview-metrics" className="sr-only">
            {t('pages.detail.groups.metrics.title')}
          </h2>
          <OverviewTiles>
            {Children.map(sections.metrics, (metric) => (
              <Suspense fallback={<OverviewTileSkeleton />}>{metric}</Suspense>
            ))}
          </OverviewTiles>
        </section>
      )}
      <section aria-labelledby="overview-activity" className="space-y-3">
        <h2 id="overview-activity" className="font-heading text-lg font-semibold">
          {t('pages.detail.groups.activity.title')}
        </h2>
        <div
          className={
            hasActivity
              ? 'grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
              : 'space-y-4'
          }
        >
          {hasActivity && (
            <div className="min-w-0">
              <OverviewBlock>{sections.activity}</OverviewBlock>
            </div>
          )}
          <div className="min-w-0 space-y-4">
            <WebsiteAboutCard
              locale={locale}
              website={website}
              publicHref={publicHref}
              publicUrl={publicUrl}
              pageCount={null}
              dataSourceCount={null}
            />
            {sections.releases !== null && <OverviewBlock>{sections.releases}</OverviewBlock>}
          </div>
        </div>
      </section>
    </AdminPage>
  );
}
