import { bookingRoutes } from '@modules/booking/client';
import { builderRoutes } from '@modules/builder/client';
import { dataSourceRoutes } from '@modules/data-sources';
import { releaseRoutes } from '@modules/release/client';
import { OnboardingCard } from '@modules/website';
import type { OnboardingStep } from '@modules/website';

import { loadBookingSummary } from '@/app/_lib/booking-summary';
import { loadDataSources } from '@/app/_lib/data-source-count';
import { orFail, orNull } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import type { BlockProps } from './block-props';

/** The first steps, ticked from what exists; each is offered only where the actor can take it. */
export async function OnboardingBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  const [status, summary, sources] = await Promise.all([
    access.may('release.read') ? orFail(loadPublicationStatus(websiteId)) : null,
    access.maySection('bookings') ? orNull(loadBookingSummary(websiteId)) : null,
    access.may('datasource.read') ? orFail(loadDataSources(websiteId)) : null,
  ]);

  const steps: OnboardingStep[] = [
    ...(status === null
      ? []
      : [
          {
            id: 'page' as const,
            isDone: status.draft.pageCount > 0,
            href: access.maySection('builder') ? builderRoutes.pages(websiteId) : null,
          },
          {
            id: 'publish' as const,
            isDone: status.live !== null,
            href: access.maySection('releases') ? releaseRoutes.releases(websiteId) : null,
          },
        ]),
    ...(summary === null
      ? []
      : [
          {
            id: 'booking' as const,
            isDone: summary.hasLocation,
            href: bookingRoutes.admin(websiteId),
          },
        ]),
    ...(sources === null || !access.maySection('data')
      ? []
      : [
          {
            id: 'dataSource' as const,
            isDone: sources.length > 0,
            href: dataSourceRoutes.sources(websiteId),
          },
        ]),
  ];

  return <OnboardingCard locale={locale} steps={steps} />;
}
