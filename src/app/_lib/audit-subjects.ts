import { subjectIdsOf } from '@modules/audit';
import type {
  AuditEntryView,
  AuditSubjectKind,
  AuditSubjects,
  AuditSubjectView,
} from '@modules/audit';
import { bookingQueries } from '@modules/booking';
import { bookingRoutes } from '@modules/booking/client';
import { builderQueries } from '@modules/builder';
import { builderRoutes } from '@modules/builder/client';
import { dataSourceQueries, dataSourceRoutes } from '@modules/data-sources';
import { releaseRoutes } from '@modules/release/client';

import { orNull } from './or-fail';
import { getWebsiteAccess } from './website-access';

type Named = ReadonlyArray<{ readonly id: string; readonly name: string }>;
type SubjectMap = Readonly<Record<string, AuditSubjectView>>;

/** Every id asked for: the named ones with their name and address, the rest as gone. */
function subjectMap(
  ids: readonly string[],
  named: Named,
  hrefOf: (id: string) => string | null,
): SubjectMap {
  const names = new Map(named.map(({ id, name }) => [id, name]));
  return Object.fromEntries(
    ids.map((id): [string, AuditSubjectView] => {
      const name = names.get(id);
      return [
        id,
        name === undefined ? { state: 'gone' } : { state: 'found', name, href: hrefOf(id) },
      ];
    }),
  );
}

/** Things this screen links to without a lookup: they are kept, never deleted (releases, updates). */
function linkedMap(ids: readonly string[], hrefOf: (id: string) => string): SubjectMap {
  return Object.fromEntries(
    ids.map((id): [string, AuditSubjectView] => [
      id,
      { state: 'found', name: null, href: hrefOf(id) },
    ]),
  );
}

/**
 * Names the pages, data, releases and bookings the shown entries refer to,
 * each with the screen that manages it. Only the ids on screen are looked up,
 * one read per kind and only for kinds that appear, and only in areas the
 * reader may see: a kind they may not read stays unnamed (absent), so the log
 * never shows a name its reader could not see elsewhere. People are named by
 * `loadMemberNames`, not here.
 */
export async function loadAuditSubjects(
  websiteId: string,
  entries: readonly AuditEntryView[],
): Promise<AuditSubjects> {
  const ids = subjectIdsOf(entries);
  const idsOf = (kind: AuditSubjectKind) => ids.get(kind) ?? [];
  const asks = (...kinds: AuditSubjectKind[]) => kinds.some((kind) => idsOf(kind).length > 0);
  const access = await getWebsiteAccess();

  const [pages, data, booking] = await Promise.all([
    access.may('page.read') && asks('page')
      ? orNull(builderQueries.resolvePageTitles.execute(websiteId, idsOf('page')))
      : null,
    access.may('datasource.read') && asks('dataSource', 'dataset')
      ? orNull(
          dataSourceQueries.resolveDataNames.execute(websiteId, {
            dataSourceIds: idsOf('dataSource'),
            datasetIds: idsOf('dataset'),
          }),
        )
      : null,
    access.may('booking.read') && asks('service', 'location', 'resource', 'booking')
      ? orNull(
          bookingQueries.resolveBookingNames.execute(websiteId, {
            serviceIds: idsOf('service'),
            locationIds: idsOf('location'),
            resourceIds: idsOf('resource'),
            bookingIds: idsOf('booking'),
          }),
        )
      : null,
  ]);

  const mayOpen = {
    builder: access.maySection('builder'),
    data: access.maySection('data'),
    bookings: access.maySection('bookings'),
    releases: access.maySection('releases'),
  };
  const bookingsHref = mayOpen.bookings ? () => bookingRoutes.admin(websiteId) : () => null;
  const dataHref = mayOpen.data ? () => dataSourceRoutes.sources(websiteId) : () => null;

  return {
    ...(pages === null
      ? {}
      : {
          page: subjectMap(
            idsOf('page'),
            pages.map(({ id, title }) => ({ id, name: title })),
            (id) => (mayOpen.builder ? builderRoutes.editor(websiteId, id) : null),
          ),
        }),
    ...(data === null
      ? {}
      : {
          dataSource: subjectMap(idsOf('dataSource'), data.dataSources, dataHref),
          dataset: subjectMap(idsOf('dataset'), data.datasets, dataHref),
        }),
    ...(booking === null
      ? {}
      : {
          service: subjectMap(idsOf('service'), booking.services, bookingsHref),
          location: subjectMap(idsOf('location'), booking.locations, (id) =>
            mayOpen.bookings ? bookingRoutes.location(websiteId, id) : null,
          ),
          resource: subjectMap(idsOf('resource'), booking.resources, bookingsHref),
          booking: subjectMap(idsOf('booking'), booking.bookings, bookingsHref),
        }),
    ...(mayOpen.releases
      ? {
          release: linkedMap(idsOf('release'), (id) => releaseRoutes.preview(websiteId, id)),
          migration: linkedMap(idsOf('migration'), () => releaseRoutes.updates(websiteId)),
        }
      : {}),
  };
}
