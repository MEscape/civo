import { Suspense } from 'react';

import type { Metadata } from 'next';

import { CreateWebsiteForm, websiteQueries, websiteRoutes } from '@modules/website';

import {
  AdminContainer,
  EmptyState,
  PageHeading,
  Section,
} from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { DataPanel } from '@components/shared/data-panel';
import { ListPagination } from '@components/shared/list-pagination';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { buttonVariants } from '@components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

import { Link, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';
import { buildQueryString } from '@lib/utils';

import { MemberWebsites } from '@/app/_lib/member-websites';
import { orFail } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

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
  const access = await getWebsiteAccess();

  // Only the platform administrator sees the websites. Everyone else belongs to one,
  // and starts there.
  if (!access.may('website.list.all')) {
    return <MemberWebsites locale={locale} landing={access.landing()} />;
  }
  const websites = await orFail(websiteQueries.listWebsites.execute({ page, pageSize }));

  return (
    <AdminContainer>
      <Section className="space-y-6 py-8">
        <PageHeading title={t('pages.list.title')} description={t('pages.list.description')} />

        <DataPanel
          title={t('pages.list.panelTitle')}
          meta={t('pages.list.count', { count: websites.total })}
          footer={
            websites.pageCount > 1 ? (
              <ListPagination
                locale={locale}
                slice={websites}
                hrefFor={(target) =>
                  `${websiteRoutes.list()}${buildQueryString({ page: target === 1 ? undefined : target, pageSize: websites.pageSize })}`
                }
                label={t('pages.list.paginationNav')}
              />
            ) : undefined
          }
        >
          {websites.total === 0 ? (
            <EmptyState
              className="py-10"
              title={t('pages.list.empty')}
              description={t('pages.list.emptyDescription')}
            />
          ) : (
            <Table containerClassName="rounded-none border-0">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('pages.list.columns.website')}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t('pages.list.columns.address')}
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">{t('pages.list.columns.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {websites.items.map((website) => (
                  <TableRow key={website.id}>
                    <TableCell className="max-w-0 sm:max-w-sm">
                      <Link
                        href={websiteRoutes.detail(website.id)}
                        className="font-medium text-copy underline-offset-4 hover:underline"
                      >
                        {website.name}
                      </Link>
                      {website.description !== null && (
                        <p className="truncate text-xs text-copy-muted">{website.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-copy-muted sm:table-cell">
                      /{website.slug}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link
                          href={websiteRoutes.audit(website.id)}
                          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                        >
                          {t('platformNav.audit')}
                        </Link>
                        <Link
                          href={websiteRoutes.users(website.id)}
                          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                        >
                          {t('platformNav.users')}
                        </Link>
                        <Link
                          href={websiteRoutes.detail(website.id)}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          {t('pages.list.open')}
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataPanel>

        {access.may('website.create') && (
          <DataPanel title={t('pages.list.createTitle')}>
            <I18nProvider locale={locale} namespaces={['website']}>
              <CreateWebsiteForm />
            </I18nProvider>
          </DataPanel>
        )}
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
