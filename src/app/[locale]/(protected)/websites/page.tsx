import { Suspense } from 'react';

import type { Metadata } from 'next';

import { CreateWebsiteForm, websiteQueries, websiteRoutes } from '@modules/website';

import {
  AdminContainer,
  EmptyState,
  Grid,
  PageHeading,
  Section,
} from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { LinkCard } from '@components/shared/link-card';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { Pagination } from '@components/shared/pagination';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';
import { buildQueryString } from '@lib/utils';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'website' });
  return buildPrivateMetadata(t('pages.list.title'));
}

async function WebsitesContent({ params, searchParams }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'website' });
  const { page, pageSize } = await searchParams;
  const websites = await orFail(websiteQueries.listWebsites.execute({ page, pageSize }));

  return (
    <AdminContainer>
      <Section className="space-y-8">
        <PageHeading title={t('pages.list.title')} description={t('pages.list.description')} />

        {websites.total === 0 ? (
          <EmptyState
            title={t('pages.list.empty')}
            description={t('pages.list.emptyDescription')}
          />
        ) : (
          <Grid columns={2} as="ul">
            {websites.items.map((website) => (
              <li key={website.id}>
                <LinkCard
                  href={websiteRoutes.detail(website.id)}
                  title={website.name}
                  description={website.description ?? website.slug}
                />
              </li>
            ))}
          </Grid>
        )}

        {websites.pageCount > 1 && (
          <Pagination
            page={websites.page}
            pageCount={websites.pageCount}
            hrefFor={(target) =>
              `${websiteRoutes.list()}${buildQueryString({ page: target === 1 ? undefined : target, pageSize: websites.pageSize })}`
            }
            labels={{
              nav: t('pages.list.pagination.nav'),
              previous: t('pages.list.pagination.previous'),
              next: t('pages.list.pagination.next'),
              summary: t('pages.list.pagination.summary', {
                first: (websites.page - 1) * websites.pageSize + 1,
                last: (websites.page - 1) * websites.pageSize + websites.items.length,
                total: websites.total,
              }),
              pageLabel: (target) => t('pages.list.pagination.page', { page: target }),
            }}
          />
        )}

        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-copy">
            {t('pages.list.createTitle')}
          </h2>
          <I18nProvider locale={locale} namespaces={['website']}>
            <CreateWebsiteForm />
          </I18nProvider>
        </div>
      </Section>
    </AdminContainer>
  );
}

export default function WebsitesPage({ params, searchParams }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WebsitesContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
