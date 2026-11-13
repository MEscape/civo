import { Suspense } from 'react';

import type { Metadata } from 'next';

import { AuditAdministration } from '@modules/audit';
import { websiteRoutes } from '@modules/website';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { AuditPageSkeleton } from '@components/skeletons/audit-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'audit' });
  return buildPrivateMetadata(t('platform.title'));
}

async function PlatformAuditContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale } = await params;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'audit' });

  return (
    <AdminPage>
      <AdminPageHeader title={t('platform.title')} description={t('platform.description')} />
      <AuditAdministration
        locale={locale}
        pathname={websiteRoutes.platformAudit()}
        scope={{ kind: 'global', websiteAuditHref: websiteRoutes.audit }}
        searchParams={await searchParams}
      />
    </AdminPage>
  );
}

export default function PlatformAuditPage(props: RouteProps) {
  return (
    <Suspense fallback={<AuditPageSkeleton />}>
      <PlatformAuditContent {...props} />
    </Suspense>
  );
}
