import { getBookingQueries, isBookingSetupComplete } from '@modules/booking';
import { bookingRoutes } from '@modules/booking/client';
import { builderRoutes } from '@modules/builder/client';
import { dataSourceRoutes, getDataSourceQueries } from '@modules/data-sources';
import { getMapQueries, mapRoutes } from '@modules/map';
import { loadPublicationStatus } from '@modules/release';
import { releaseRoutes } from '@modules/release/client';
import { OnboardingCard } from '@modules/website';
import type { OnboardingStep } from '@modules/website';

import type { Locale } from '@i18n';

import { orNull } from '@lib/errors/or-null';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface OverviewOnboardingProps {
  readonly websiteId: string;
  readonly locale: Locale;
}

/** Where a step starts, or no link for an actor who may not take it there. */
function startHref(isAllowed: boolean, href: string): string | null {
  return isAllowed ? href : null;
}

/** The first steps, ticked from what exists; each is offered only where the actor can take it. */
export async function OverviewOnboarding({ websiteId, locale }: OverviewOnboardingProps) {
  const access = await getWebsiteAccess();
  const [status, setup, sources, maps] = await Promise.all([
    orNull(loadPublicationStatus(websiteId)),
    access.maySection('bookings')
      ? orNull(getBookingQueries().getBookingSetup.execute({ websiteId }))
      : null,
    access.maySection('data')
      ? orNull(
          getDataSourceQueries().listDataSourcesWithDatasets.execute(websiteId, { pageSize: 1 }),
        )
      : null,
    access.maySection('maps')
      ? orNull(getMapQueries().listSavedMaps.execute(websiteId, { page: 1, pageSize: 1 }))
      : null,
  ]);

  // In the order the work builds on itself: content, the data a map shows, the map, then publishing.
  // Each "start" opens the create screen itself, so the next thing to do is one click away.
  const steps: OnboardingStep[] = [
    ...(status === null
      ? []
      : [
          {
            id: 'page' as const,
            isDone: status.draft.pageCount > 0,
            href: startHref(access.may('page.create'), builderRoutes.create(websiteId)),
          },
        ]),
    ...(sources === null
      ? []
      : [
          {
            id: 'dataSource' as const,
            isDone: sources.total > 0,
            href: startHref(access.may('datasource.create'), dataSourceRoutes.sourceNew(websiteId)),
          },
        ]),
    ...(maps === null
      ? []
      : [
          {
            id: 'map' as const,
            isDone: maps.total > 0,
            // Saving a map needs page.update, so the create screen is only offered to whoever may save.
            href: startHref(access.may('page.update'), mapRoutes.create(websiteId)),
          },
        ]),
    ...(setup === null
      ? []
      : [
          {
            id: 'booking' as const,
            isDone: isBookingSetupComplete(setup),
            href: bookingRoutes.admin(websiteId),
          },
        ]),
    ...(status === null
      ? []
      : [
          {
            id: 'publish' as const,
            isDone: status.live !== null,
            href: startHref(access.maySection('releases'), releaseRoutes.releases(websiteId)),
          },
        ]),
  ];

  return <OnboardingCard locale={locale} steps={steps} />;
}
