import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { UsersAdministration, isAuthEnabled } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { PageSkeleton } from '@components/shared/page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('users.metadata.title'));
}

async function UsersContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'auth' });

  // Users live in the authentication store, which only exists while sign-in does.
  if (!isAuthEnabled) {
    notFound();
  }

  return (
    <AdminContainer>
      <Section className="space-y-8">
        <PageHeading title={t('users.title')} description={t('users.description')} />
        <UsersAdministration
          locale={locale}
          pathname={websiteRoutes.users(websiteId)}
          searchParams={await searchParams}
        />
      </Section>
    </AdminContainer>
  );
}

export default function UsersPage(props: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UsersContent {...props} />
    </Suspense>
  );
}
