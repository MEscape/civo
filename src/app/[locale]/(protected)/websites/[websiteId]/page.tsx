import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { RefreshOnFocus } from '@components/shared/refresh-on-focus';

import { redirect, requireLocale } from '@i18n';

import { buildPrivateMetadata } from '@lib/seo';

import { loadWebsite } from '@/app/_lib/load-website';
import { orFail } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import { AboutBlock } from './_overview/about-block';
import { ActivityBlock } from './_overview/activity-block';
import { AuditBlock } from './_overview/audit-block';
import { BlockSkeleton } from './_overview/block-skeleton';
import { BookingBlock } from './_overview/booking-block';
import { OnboardingBlock } from './_overview/onboarding-block';
import { OverviewHeader } from './_overview/overview-header';
import { PeopleBlock } from './_overview/people-block';
import { PublicationBlock } from './_overview/publication-block';

import type { BlockProps } from './_overview/block-props';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { websiteId } = await params;
  const website = await orFail(loadWebsite(websiteId));
  return buildPrivateMetadata(website.name);
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
          <Suspense fallback={<BlockSkeleton />}>
            <AuditBlock websiteId={websiteId} locale={locale} />
          </Suspense>
        </div>
        <div className="space-y-6">
          <Suspense fallback={<BlockSkeleton />}>
            <AboutBlock websiteId={websiteId} locale={locale} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton />}>
            <ActivityBlock websiteId={websiteId} locale={locale} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton />}>
            <PeopleBlock websiteId={websiteId} locale={locale} />
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
