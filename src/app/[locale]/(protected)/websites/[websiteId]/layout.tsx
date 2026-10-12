import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { getHeldPermissions, isAuthEnabled } from '@modules/auth';
import { bookingRoutes } from '@modules/booking/client';
import { builderRoutes } from '@modules/builder/client';
import { releaseRoutes } from '@modules/release/client';
import { websiteRoutes } from '@modules/website';

import { AppNav } from '@components/layout/app-nav';
import { AdminContainer } from '@components/layout/layout-primitives';
import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

async function SectionNav({ params }: Pick<LayoutProps, 'params'>) {
  const { locale: rawLocale, websiteId } = await params;
  const t = await getTranslations({ locale: requireLocale(rawLocale), namespace: 'website' });
  // Each tab is shown to people who may use it. This is display only: every page and
  // use case behind a tab authorizes on its own.
  const held = await getHeldPermissions([
    'website.read',
    'booking.read',
    'booking.read.own',
    'user.read',
  ]);
  const canSeeWebsite = held.has('website.read');
  const canSeeBookings = held.has('booking.read') || held.has('booking.read.own');

  return (
    <AppNav
      variant="section"
      label={t('nav.label')}
      hiddenBelow={builderRoutes.pages(websiteId)}
      links={[
        ...(canSeeWebsite
          ? [
              { href: websiteRoutes.detail(websiteId), label: t('nav.overview'), isExact: true },
              {
                href: builderRoutes.pages(websiteId),
                label: t('pages.detail.links.builder.title'),
              },
            ]
          : []),
        ...(canSeeBookings
          ? [
              {
                href: bookingRoutes.admin(websiteId),
                label: t('pages.detail.links.bookings.title'),
              },
            ]
          : []),
        ...(canSeeWebsite
          ? [
              {
                href: releaseRoutes.migrations(websiteId),
                label: t('pages.detail.links.migrations.title'),
              },
              {
                href: websiteRoutes.settings(websiteId),
                label: t('pages.detail.links.settings.title'),
              },
            ]
          : []),
        ...(isAuthEnabled && held.has('user.read')
          ? [{ href: websiteRoutes.users(websiteId), label: t('nav.users') }]
          : []),
      ]}
    />
  );
}

/** Every page of one website shares the way between its sections. */
export default function WebsiteLayout({ children, params }: LayoutProps) {
  return (
    <>
      <AdminContainer>
        <Suspense fallback={<Skeleton className="mb-6 h-10 w-full" />}>
          <SectionNav params={params} />
        </Suspense>
      </AdminContainer>
      {children}
    </>
  );
}
