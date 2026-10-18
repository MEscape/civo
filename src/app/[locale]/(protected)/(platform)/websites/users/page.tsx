import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { PlatformAdmins, PlatformUsersAdministration, isAuthEnabled } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { Alert } from '@components/ui/alert';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';
import { loadWebsiteOptions } from '@/app/_lib/website-options';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('platformUsers.metadata.title'));
}

async function PlatformUsersContent({ params, searchParams }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const access = await getWebsiteAccess();
  // Accounts live in the authentication store, which only exists while sign-in does; and only the platform's administrators list everyone.
  if (!isAuthEnabled || !access.may('platform.admin.manage')) {
    notFound();
  }
  const [t, tw, { websites, isTruncated }] = await Promise.all([
    getTranslations({ locale, namespace: 'auth' }),
    getTranslations({ locale, namespace: 'website' }),
    loadWebsiteOptions(),
  ]);

  return (
    <AdminContainer>
      <Section className="space-y-8 py-8">
        <PageHeading
          title={t('platformUsers.title')}
          description={t('platformUsers.description')}
        />
        {isTruncated && (
          <Alert variant="warning" role="status">
            {tw('platformNav.optionsTruncated')}
          </Alert>
        )}
        <PlatformUsersAdministration
          locale={locale}
          pathname={websiteRoutes.platformUsers()}
          searchParams={await searchParams}
          websites={websites}
          websiteUsersHref={websiteRoutes.users}
        />
        <PlatformAdmins locale={locale} />
      </Section>
    </AdminContainer>
  );
}

export default function PlatformUsersPage(props: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlatformUsersContent {...props} />
    </Suspense>
  );
}
