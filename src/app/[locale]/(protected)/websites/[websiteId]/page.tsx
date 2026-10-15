import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { BookingOverviewCard } from '@modules/booking';
import { bookingRoutes } from '@modules/booking/client';
import { builderRoutes } from '@modules/builder/client';
import { PublicationBanner, ReleaseActivityCard } from '@modules/release';
import { releaseRoutes } from '@modules/release/client';
import { OnboardingCard, WebsiteAboutCard, websiteRoutes } from '@modules/website';
import type { OnboardingStep } from '@modules/website';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { RefreshOnFocus } from '@components/shared/refresh-on-focus';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';
import { ExternalLink } from '@components/ui/icons';
import { Skeleton } from '@components/ui/skeleton';

import { Link, redirect, requireLocale } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { publicEnv } from '@lib/config';
import { buildPrivateMetadata } from '@lib/seo';

import { loadBookingSummary } from '@/app/_lib/booking-summary';
import { loadDataSources } from '@/app/_lib/data-source-count';
import { loadWebsite } from '@/app/_lib/load-website';
import { loadMemberNames } from '@/app/_lib/member-names';
import { orFail, orNull } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';
import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

interface BlockProps {
  readonly websiteId: string;
  readonly locale: Locale;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { websiteId } = await params;
  const website = await orFail(loadWebsite(websiteId));
  return buildPrivateMetadata(website.name);
}

/** Each block streams in on its own, so a slow read never holds back the others. */
function BlockSkeleton({ className }: { readonly className?: string }) {
  return <Skeleton aria-hidden="true" className={className ?? 'h-40 w-full'} />;
}

/** The full address a visitor types, for the copy button. */
function publicUrlOf(locale: Locale, slug: string): string {
  const path = releaseRoutes.publicSite(slug).replace(/^\//, '');
  return new URL(`/${locale}/${path}`, publicEnv.NEXT_PUBLIC_APP_URL).href;
}

/** The name, where it is served and whether it is live, with the two things done most: look at it, edit it. */
async function OverviewHeader({ websiteId, locale }: BlockProps) {
  const [access, website, t] = await Promise.all([
    getWebsiteAccess(),
    orFail(loadWebsite(websiteId)),
    getTranslations({ locale, namespace: 'website' }),
  ]);
  const status = access.may('release.read') ? await orFail(loadPublicationStatus(websiteId)) : null;
  const isLive = (status?.live ?? null) !== null;

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <PageHeading title={website.name} description={website.description ?? undefined} />
        {status !== null && (
          <p className="flex items-center gap-2 text-sm text-copy-muted">
            <span>{website.slug}</span>
            <Badge variant={isLive ? 'success' : 'muted'}>
              {isLive ? t('pages.detail.live') : t('pages.detail.notPublished')}
            </Badge>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {isLive && (
          <Link
            href={releaseRoutes.publicSite(website.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('pages.detail.viewSite')}
            <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
        )}
        {access.maySection('builder') && (
          <Link href={builderRoutes.pages(websiteId)} className={buttonVariants()}>
            {t('pages.detail.editSite')}
          </Link>
        )}
      </div>
    </header>
  );
}

async function PublicationBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  if (!access.may('release.read')) {
    return null;
  }
  const status = await orFail(loadPublicationStatus(websiteId));

  return (
    <I18nProvider locale={locale} namespaces={['release']}>
      <PublicationBanner
        locale={locale}
        websiteId={websiteId}
        status={status}
        mayPublish={access.may('release.publish')}
        mayUpdate={access.may('release.publish')}
      />
    </I18nProvider>
  );
}

/** The first steps, ticked from what exists; each is offered only where the actor can take it. */
async function OnboardingBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  const [status, summary, sources] = await Promise.all([
    access.may('release.read') ? orFail(loadPublicationStatus(websiteId)) : null,
    access.maySection('bookings') ? orNull(loadBookingSummary(websiteId)) : null,
    access.may('datasource.read') ? orFail(loadDataSources(websiteId)) : null,
  ]);

  const steps: OnboardingStep[] = [
    ...(status === null
      ? []
      : [
          {
            id: 'page' as const,
            isDone: status.draft.pageCount > 0,
            href: access.maySection('builder') ? builderRoutes.pages(websiteId) : null,
          },
          {
            id: 'publish' as const,
            isDone: status.live !== null,
            href: access.maySection('releases') ? releaseRoutes.releases(websiteId) : null,
          },
        ]),
    ...(summary === null
      ? []
      : [
          {
            id: 'booking' as const,
            isDone: summary.hasLocation,
            href: bookingRoutes.admin(websiteId),
          },
        ]),
    ...(sources === null || !access.maySection('settings')
      ? []
      : [
          {
            id: 'dataSource' as const,
            isDone: sources.length > 0,
            href: websiteRoutes.settings(websiteId),
          },
        ]),
  ];

  return <OnboardingCard locale={locale} steps={steps} />;
}

async function BookingBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  if (!access.maySection('bookings')) {
    return null;
  }
  const summary = await orNull(loadBookingSummary(websiteId));

  return summary === null ? null : (
    <BookingOverviewCard websiteId={websiteId} locale={locale} summary={summary} />
  );
}

async function ActivityBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  if (!access.may('release.read')) {
    return null;
  }
  const status = await orFail(loadPublicationStatus(websiteId));
  const authors = await loadMemberNames(status.recent.map((release) => release.publishedBy));

  return (
    <ReleaseActivityCard
      locale={locale}
      websiteId={websiteId}
      status={status}
      linkToReleases={access.maySection('releases')}
      authors={authors}
    />
  );
}

async function AboutBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  const [website, status, sources] = await Promise.all([
    orFail(loadWebsite(websiteId)),
    access.may('release.read') ? orFail(loadPublicationStatus(websiteId)) : null,
    access.may('datasource.read') ? orFail(loadDataSources(websiteId)) : null,
  ]);
  const isLive = (status?.live ?? null) !== null;

  return (
    <WebsiteAboutCard
      locale={locale}
      website={website}
      publicHref={isLive ? releaseRoutes.publicSite(website.slug) : null}
      publicUrl={isLive ? publicUrlOf(locale, website.slug) : null}
      pageCount={status?.draft.pageCount ?? null}
      dataSourceCount={sources?.length ?? null}
    />
  );
}

async function WebsiteDetails({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  // An employee has no overview: they start where they work.
  if (!access.maySection('overview')) {
    const landing = access.landing();
    return landing === null ? notFound() : redirect({ href: landing, locale });
  }
  const website = await orFail(loadWebsite(websiteId));

  return (
    <Section className="space-y-6 py-8">
      <RefreshOnFocus />
      <Suspense fallback={<PageHeading title={website.name} />}>
        <OverviewHeader websiteId={websiteId} locale={locale} />
      </Suspense>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Suspense fallback={<BlockSkeleton className="h-24 w-full" />}>
            <PublicationBlock websiteId={websiteId} locale={locale} />
          </Suspense>
          <Suspense fallback={null}>
            <OnboardingBlock websiteId={websiteId} locale={locale} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton />}>
            <BookingBlock websiteId={websiteId} locale={locale} />
          </Suspense>
        </div>
        <div className="space-y-6">
          <Suspense fallback={<BlockSkeleton />}>
            <AboutBlock websiteId={websiteId} locale={locale} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton />}>
            <ActivityBlock websiteId={websiteId} locale={locale} />
          </Suspense>
        </div>
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
