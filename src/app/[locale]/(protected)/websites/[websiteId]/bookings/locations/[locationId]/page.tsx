import { Suspense } from 'react';

import type { Metadata } from 'next';

import { LocationWorkspacePage } from '@modules/booking';

import { AdminContainer, Section } from '@components/layout/layout-primitives';
import { PageSkeleton } from '@components/shared/page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; locationId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('workspace.title'));
}

async function LocationContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId, locationId } = await params;
  return (
    <AdminContainer>
      <Section className="space-y-8 py-8">
        <LocationWorkspacePage
          websiteId={websiteId}
          locationId={locationId}
          locale={requireLocale(rawLocale)}
        />
      </Section>
    </AdminContainer>
  );
}

export default function WebsiteLocationPage({ params }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LocationContent params={params} />
    </Suspense>
  );
}
