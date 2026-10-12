import { cache, Suspense } from 'react';

import type { Metadata } from 'next';

import { bookingRoutes } from '@modules/booking/client';
import { builderRoutes } from '@modules/builder/client';
import { ReleaseHistoryPanel, releaseQueries } from '@modules/release';
import { releaseRoutes, toReleaseHistoryDto } from '@modules/release/client';
import { websiteQueries, websiteRoutes } from '@modules/website';

import { AdminContainer, Grid, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { LinkCard } from '@components/shared/link-card';
import { PageSkeleton } from '@components/shared/page-skeleton';

import { requireLocale } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

/** Deduplicates the load between `generateMetadata` and the page within one request. */
const loadWebsite = cache((websiteId: string) => websiteQueries.getWebsiteById.execute(websiteId));

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { websiteId } = await params;
  const website = await orFail(loadWebsite(websiteId));
  return buildPrivateMetadata(website.name);
}

async function WebsiteDetails({
  websiteId,
  locale,
}: {
  readonly websiteId: string;
  readonly locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'website' });
  const [website, history] = await Promise.all([
    orFail(loadWebsite(websiteId)),
    orFail(releaseQueries.listReleases.execute(websiteId)),
  ]);

  const links = [
    { key: 'builder', href: builderRoutes.pages(website.id) },
    { key: 'bookings', href: bookingRoutes.admin(website.id) },
    { key: 'settings', href: websiteRoutes.settings(website.id) },
    { key: 'migrations', href: releaseRoutes.migrations(website.id) },
  ] as const;

  return (
    <Section className="space-y-8">
      <PageHeading title={website.name} description={website.description ?? undefined} />

      <Grid columns={3} as="ul">
        {links.map(({ key, href }) => (
          <li key={key}>
            <LinkCard
              href={href}
              title={t(`pages.detail.links.${key}.title`)}
              description={t(`pages.detail.links.${key}.description`)}
            />
          </li>
        ))}
      </Grid>

      <div className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-copy">
          {t('pages.detail.releasesTitle')}
        </h2>
        <I18nProvider locale={locale} namespaces={['release']}>
          <ReleaseHistoryPanel
            websiteId={website.id}
            history={toReleaseHistoryDto(history)}
            publicSiteHref={releaseRoutes.publicSite(website.slug)}
          />
        </I18nProvider>
      </div>
    </Section>
  );
}

async function WebsiteContent({ params }: RouteProps) {
  const { locale, websiteId } = await params;
  return (
    <AdminContainer>
      <WebsiteDetails websiteId={websiteId} locale={requireLocale(locale)} />
    </AdminContainer>
  );
}

export default function WebsitePage({ params }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WebsiteContent params={params} />
    </Suspense>
  );
}
