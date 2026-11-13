import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { getAuthQueries, isAuthEnabled } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { AppNav } from '@components/layout/app-nav';
import { SectionBar } from '@components/layout/layout-primitives';
import { SectionBarSkeleton } from '@components/skeletons/section-bar-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

/**
 * The way between the platform's own screens (all websites, their audit log,
 * their people), as one line under the app header: the same bar a website has,
 * one level up. It holds only the platform's own screens; a person's way into bookings is a website's
 * row in the list, the bookings hub, or the switcher of a workspace. Each link follows the actor's reach across memberships,
 * independently of the website currently selected by the request.
 */
async function PlatformNav({ params }: Pick<LayoutProps, 'params'>) {
  const locale = requireLocale((await params).locale);
  const queries = getAuthQueries();
  const [t, readable, auditable, managed] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    orNull(queries.listAccessibleWebsites.execute('website.read')),
    orNull(queries.listAccessibleWebsites.execute('audit.read')),
    isAuthEnabled ? orNull(queries.listManageableWebsites.execute()) : null,
  ]);
  const links = [
    {
      isShown: readable !== null,
      href: websiteRoutes.list(),
      label: t('platformNav.websites'),
      isExact: true,
    },
    {
      isShown: auditable !== null,
      href: websiteRoutes.platformAudit(),
      label: t('platformNav.audit'),
    },
    {
      isShown: managed !== null,
      href: websiteRoutes.platformUsers(),
      label: t('platformNav.users'),
    },
  ].flatMap(({ isShown, ...link }) => (isShown ? [link] : []));
  if (links.length === 0) {
    return null;
  }

  return (
    <SectionBar>
      <AppNav
        variant="section"
        label={t('platformNav.label')}
        compactLabel={t('platformNav.label')}
        moreLabel={t('nav.more')}
        links={links}
      />
    </SectionBar>
  );
}

export default function PlatformLayout({ children, params }: LayoutProps) {
  return (
    <>
      <Suspense
        fallback={
          <SectionBar>
            <SectionBarSkeleton hasName={false} tabs={3} />
          </SectionBar>
        }
      >
        <PlatformNav params={params} />
      </Suspense>
      {children}
    </>
  );
}
