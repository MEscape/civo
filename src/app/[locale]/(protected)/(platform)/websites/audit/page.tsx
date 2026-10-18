import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { AuditLog, parseAuditParams } from '@modules/audit';
import { websiteQueries, websiteRoutes } from '@modules/website';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { RefreshOnFocus } from '@components/shared/refresh-on-focus';
import { Alert } from '@components/ui/alert';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { loadAuditEventLabels } from '@/app/_lib/audit-event-labels';
import { loadMemberNames } from '@/app/_lib/member-names';
import { orFail } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';
import { loadWebsiteOptions } from '@/app/_lib/website-options';

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
  const locale = requireLocale((await params).locale);
  const access = await getWebsiteAccess();
  // Nobody who may not list every website learns that this page exists.
  if (!access.may('website.list.all')) {
    notFound();
  }
  const { filter, page } = parseAuditParams(await searchParams);
  const [t, tw, trail, { websites, isTruncated }] = await Promise.all([
    getTranslations({ locale, namespace: 'audit' }),
    getTranslations({ locale, namespace: 'website' }),
    orFail(websiteQueries.getPlatformAuditTrail.execute(filter, page)),
    loadWebsiteOptions(),
  ]);

  const shown = trail.entries.items;
  const named = shown.flatMap((entry) => {
    const subject = entry.details['subjectId'];
    return [entry.actorId, typeof subject === 'string' ? subject : null];
  });
  // People are named within one lookup of what the page shows, and one of everyone the filter offers.
  const [pageNames, memberNames, eventLabels] = await Promise.all([
    loadMemberNames(named),
    loadMemberNames(trail.memberIds),
    loadAuditEventLabels(locale, [...trail.types, ...shown]),
  ]);
  const names = pageNames === null ? null : { ...memberNames, ...pageNames };

  return (
    <AdminContainer>
      <Section className="space-y-6 py-8">
        <RefreshOnFocus />
        <PageHeading title={t('platform.title')} description={t('platform.description')} />
        {isTruncated && (
          <Alert variant="warning" role="status">
            {tw('platformNav.optionsTruncated')}
          </Alert>
        )}
        <AuditLog
          locale={locale}
          pathname={websiteRoutes.platformAudit()}
          filter={filter}
          trail={trail}
          eventLabels={eventLabels}
          names={names}
          // Names of pages, data and bookings are looked up within one website; across all of them the entry shows ids.
          subjects={{}}
          websites={websites}
          websiteAuditHref={websiteRoutes.audit}
        />
      </Section>
    </AdminContainer>
  );
}

export default function PlatformAuditPage(props: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlatformAuditContent {...props} />
    </Suspense>
  );
}
