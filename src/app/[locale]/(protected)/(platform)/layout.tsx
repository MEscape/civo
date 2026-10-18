import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { websiteRoutes } from '@modules/website';

import { AppNav } from '@components/layout/app-nav';
import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * The way between the platform's own screens (all websites, their audit log,
 * their people), as one line under the app header: the same bar a website has,
 * one level up. Only the platform's administrators have these screens; for
 * everyone else the page itself answers and no bar is drawn.
 */
async function PlatformNav({ params }: Pick<LayoutProps, 'params'>) {
  const locale = requireLocale((await params).locale);
  const [t, access] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    getWebsiteAccess(),
  ]);
  if (!access.may('website.list.all')) {
    return null;
  }

  return (
    <div className="sticky top-app-header z-30 flex h-website-bar shrink-0 items-stretch border-b border-border bg-surface px-4">
      <AppNav
        variant="section"
        label={t('platformNav.label')}
        compactLabel={t('platformNav.label')}
        moreLabel={t('nav.more')}
        links={[
          { href: websiteRoutes.list(), label: t('platformNav.websites'), isExact: true },
          { href: websiteRoutes.platformAudit(), label: t('platformNav.audit') },
          { href: websiteRoutes.platformUsers(), label: t('platformNav.users') },
        ]}
      />
    </div>
  );
}

export default function PlatformLayout({ children, params }: LayoutProps) {
  return (
    <>
      <Suspense
        fallback={
          <div className="sticky top-app-header z-30 flex h-website-bar items-center border-b border-border bg-surface px-4">
            <Skeleton className="h-5 w-64" />
          </div>
        }
      >
        <PlatformNav params={params} />
      </Suspense>
      {children}
    </>
  );
}
