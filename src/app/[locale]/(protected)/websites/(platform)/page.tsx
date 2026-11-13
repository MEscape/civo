import { Suspense } from 'react';

import type { Metadata } from 'next';

import { loadWebsiteListLinks } from '@modules/booking';
import { WebsitesAdministration, websiteRoutes } from '@modules/website';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { WebsitesPageSkeleton } from '@components/skeletons/websites-page-skeleton';
import { buttonVariants } from '@components/ui/button';

import { Link, redirect, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

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
  const [t, access, bookings] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    getWebsiteAccess(),
    loadWebsiteListLinks(locale),
  ]);
  // Nothing to open here, only bookings (an employee): the list would be empty, so go where the work is.
  if (bookings.landing !== undefined) {
    return redirect({ href: bookings.landing, locale });
  }
  const canCreate = access.may('website.create');

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('pages.list.title')}
        description={t('pages.list.description')}
        actions={
          canCreate && (
            <Link href={websiteRoutes.create()} className={buttonVariants()}>
              {t('pages.list.createTitle')}
            </Link>
          )
        }
      />
      <WebsitesAdministration
        locale={locale}
        pathname={websiteRoutes.list()}
        searchParams={await searchParams}
        canCreate={canCreate}
        alsoOpen={bookings.alsoOpen}
        elsewhere={bookings.elsewhere}
      />
    </AdminPage>
  );
}

export default function WebsitesPage(props: RouteProps) {
  return (
    <Suspense fallback={<WebsitesPageSkeleton />}>
      <WebsitesContent {...props} />
    </Suspense>
  );
}
