import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { bookingRoutes } from '@modules/booking/client';
import { builderRoutes } from '@modules/builder/client';
import { releaseRoutes } from '@modules/release/client';
import { websiteRoutes } from '@modules/website';

import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { WebsiteSectionNav } from '@/app/_lib/website-section-nav.client';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

async function SectionNav({ params }: Pick<LayoutProps, 'params'>) {
  const { locale: rawLocale, websiteId } = await params;
  const t = await getTranslations({ locale: requireLocale(rawLocale), namespace: 'website' });

  return (
    <WebsiteSectionNav
      label={t('nav.label')}
      hiddenBelow={builderRoutes.pages(websiteId)}
      links={[
        { href: websiteRoutes.detail(websiteId), label: t('nav.overview'), isExact: true },
        { href: builderRoutes.pages(websiteId), label: t('pages.detail.links.builder.title') },
        { href: bookingRoutes.admin(websiteId), label: t('pages.detail.links.bookings.title') },
        {
          href: releaseRoutes.migrations(websiteId),
          label: t('pages.detail.links.migrations.title'),
        },
        { href: websiteRoutes.settings(websiteId), label: t('pages.detail.links.settings.title') },
      ]}
    />
  );
}

/** Every page of one website shares the way between its sections. */
export default function WebsiteLayout({ children, params }: LayoutProps) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mx-auto mb-6 h-10 w-full max-w-4xl" />}>
        <SectionNav params={params} />
      </Suspense>
      {children}
    </>
  );
}
