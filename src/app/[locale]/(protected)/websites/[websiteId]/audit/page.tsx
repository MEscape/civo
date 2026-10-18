import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { AuditLog, parseAuditParams } from '@modules/audit';
import { websiteQueries, websiteRoutes } from '@modules/website';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { RefreshOnFocus } from '@components/shared/refresh-on-focus';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { loadAuditEventLabels } from '@/app/_lib/audit-event-labels';
import { loadAuditSubjects } from '@/app/_lib/audit-subjects';
import { loadMemberNames } from '@/app/_lib/member-names';
import { orFail } from '@/app/_lib/or-fail';
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
  const access = await getWebsiteAccess();
  // Nobody who may not read the trail learns that this page exists.
  if (!access.maySection('audit')) {
    notFound();
  }
  const { filter, page } = parseAuditParams(await searchParams);
  const [t, trail] = await Promise.all([
    getTranslations({ locale, namespace: 'audit' }),
    orFail(websiteQueries.getAuditTrail.execute(websiteId, filter, page)),
  ]);

  const shown = trail.entries.items;
  const named = shown.flatMap((entry) => {
    const subject = entry.details['subjectId'];
    return [entry.actorId, typeof subject === 'string' ? subject : null];
  });
  // Two lookups, each within what one lookup names: the page's people, and everyone the filter offers.
  // The things the shown entries name are looked up once per kind, for this page only.
  const [pageNames, memberNames, eventLabels, subjects] = await Promise.all([
    loadMemberNames(named),
    loadMemberNames(trail.memberIds),
    loadAuditEventLabels(locale, [...trail.types, ...shown]),
    loadAuditSubjects(websiteId, shown),
  ]);
  const names = pageNames === null ? null : { ...memberNames, ...pageNames };

  return (
    <AdminContainer>
      <Section className="space-y-6 py-8">
        <RefreshOnFocus />
        <PageHeading title={t('page.title')} description={t('page.description')} />
        <AuditLog
          locale={locale}
          pathname={websiteRoutes.audit(websiteId)}
          filter={filter}
          trail={trail}
          eventLabels={eventLabels}
          names={names}
          subjects={subjects}
        />
      </Section>
    </AdminContainer>
  );
}

export default function AuditPage(props: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuditContent {...props} />
    </Suspense>
  );
}
