import { Suspense } from 'react';

import type { Metadata } from 'next';

import { loadWebsite } from '@modules/website';

import { WebsiteOverviewSkeleton } from '@components/skeletons/website-overview-skeleton';

import { requireLocale } from '@i18n';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

import { WebsiteOverview } from './_components/website-overview';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { websiteId } = await params;
  const website = await orFail(loadWebsite(websiteId));
  return buildPrivateMetadata(website.name);
}

async function WebsiteContent({ params }: RouteProps) {
  const { locale, websiteId } = await params;
  return <WebsiteOverview websiteId={websiteId} locale={requireLocale(locale)} />;
}

export default function WebsitePage(props: RouteProps) {
  return (
    <Suspense fallback={<WebsiteOverviewSkeleton />}>
      <WebsiteContent {...props} />
    </Suspense>
  );
}
