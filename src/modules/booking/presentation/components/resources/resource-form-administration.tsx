import { connection } from 'next/server';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { resourceListNavigation } from '../../forms/resource-list-navigation';
import { parseResourceSection, parseResourceStep } from '../../forms/resource-steps';
import {
  loadResourceDetail,
  loadResourceLocation,
} from '../../loaders/load-resources-administration';
import { BookingAdminPage } from '../shared/booking-admin-page';

import { ResourceForm } from './resource-form.client';

import type { RawSearchParams } from '../../loaders/booking-readers';

export interface ResourceFormAdministrationProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  /** The resource being changed; absent: a new one. */
  readonly resourceId?: string | undefined;
  readonly searchParams: RawSearchParams;
}

/** The form that creates a resource at a location or changes one, a step or a part at a time. */
export async function ResourceFormAdministration({
  locale,
  websiteId,
  locationId,
  resourceId,
  searchParams,
}: ResourceFormAdministrationProps) {
  // The loaders read the clock; that needs the request first, or it would be baked into a prerender.
  await connection();
  const queries = getBookingQueries();
  const t = await getTranslations({ locale, namespace: 'booking' });
  const resource =
    resourceId === undefined
      ? null
      : await loadResourceDetail({ websiteId, locationId, resourceId }, queries);
  const location =
    resource === null
      ? await loadResourceLocation({ websiteId, locationId }, queries)
      : { id: resource.location.id, name: resource.location.name, weekly: resource.locationWeekly };
  const requested = parseResourceSection(searchParams['section']);

  return (
    <BookingAdminPage
      locale={locale}
      websiteId={websiteId}
      scope={{
        area: 'resources',
        locationId,
        locationName: location.name,
        listHref: resourceListNavigation.parent(
          websiteId,
          locationId,
          resourceListNavigation.parse(searchParams['list']),
        ),
      }}
      crumbs={[{ label: resource === null ? t('resources.form.newTitle') : resource.name }]}
      title={
        resource === null
          ? t('resources.form.newTitle')
          : t('resources.form.editTitle', { name: resource.name })
      }
      description={
        resource === null
          ? t('resources.titleAt', { location: location.name })
          : t('resources.overview.subtitle', { location: location.name })
      }
      unsavedBody={t('resources.form.unsavedBody')}
    >
      <ResourceForm
        // A new version (after saving, or somebody else saving) starts the form afresh from what is stored.
        key={resource?.version}
        websiteId={websiteId}
        location={{ id: location.id, name: location.name, weekly: location.weekly }}
        resource={resource}
        section={requested === 'all' ? 'wizard' : requested}
        step={parseResourceStep(searchParams['step'])}
        listOrigin={resourceListNavigation.parse(searchParams['list'])}
      />
    </BookingAdminPage>
  );
}
