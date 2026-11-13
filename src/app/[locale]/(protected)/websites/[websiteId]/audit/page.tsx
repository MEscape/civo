import { Suspense } from 'react';

import type { Metadata } from 'next';

import { AuditAdministration } from '@modules/audit';
import { websiteRoutes } from '@modules/website';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { AuditPageSkeleton } from '@components/skeletons/audit-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { auditSubjectResolver } from '@/app/_lib/audit-subjects';
import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'audit' });
  return buildPrivateMetadata(t('page.title'));
}

async function AuditContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [t, access] = await Promise.all([
    getTranslations({ locale, namespace: 'audit' }),
    getWebsiteAccess(),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader title={t('page.title')} description={t('page.description')} />
      <AuditAdministration
        locale={locale}
        pathname={websiteRoutes.audit(websiteId)}
        scope={{ kind: 'website', websiteId }}
        searchParams={await searchParams}
        resolveSubjects={auditSubjectResolver(websiteId, access)}
      />
    </AdminPage>
  );
}

export default function AuditPage(props: RouteProps) {
  return (
    <Suspense fallback={<AuditPageSkeleton />}>
      <AuditContent {...props} />
    </Suspense>
  );
}
