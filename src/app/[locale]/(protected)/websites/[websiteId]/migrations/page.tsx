import { Suspense } from 'react';

import type { Metadata } from 'next';

import { releaseRoutes } from '@modules/release/client';

import { PageSkeleton } from '@components/shared/page-skeleton';

import { redirect, requireLocale } from '@i18n';

export const metadata: Metadata = { robots: { index: false } };

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

async function MigrationsRedirect({ params }: RouteProps) {
  const { locale, websiteId } = await params;
  return redirect({ href: releaseRoutes.updates(websiteId), locale: requireLocale(locale) });
}

/** Component updates moved into the release screen; an old link or bookmark lands on their tab. */
export default function MigrationsPage({ params }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MigrationsRedirect params={params} />
    </Suspense>
  );
}
