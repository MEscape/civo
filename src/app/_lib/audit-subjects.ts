import type {
  AuditSubjectIds,
  AuditSubjectKind,
  AuditSubjects,
  AuditSubjectView,
  ResolveAuditSubjects,
} from '@modules/audit';
import { getBookingQueries } from '@modules/booking';
import { bookingRoutes } from '@modules/booking/client';
import { getBuilderQueries } from '@modules/builder';
import { builderRoutes } from '@modules/builder/client';
import { dataSourceRoutes, getDataSourceQueries } from '@modules/data-sources';
import { getMapQueries } from '@modules/map';
import { mapRoutes } from '@modules/map/client';
import { releaseRoutes } from '@modules/release/client';

import { orNull } from '@lib/errors/or-null';
import { DEFAULT_PAGE_LIMITS } from '@lib/pagination';

import type { getWebsiteAccess } from './website-access';

type WebsiteAccess = Awaited<ReturnType<typeof getWebsiteAccess>>;
type SubjectViews = Readonly<Record<string, AuditSubjectView>>;
type Found = Partial<Record<AuditSubjectKind, SubjectViews>>;

interface NamedThing {
  readonly id: string;
  readonly name: string;
}

interface Lookup {
  readonly websiteId: string;
  readonly ids: (kind: AuditSubjectKind) => readonly string[];
}

/** A thing without a name of its own (a booking, a release): found, shown by what it is and linked to its list. */
function unnamed(ids: readonly string[], href: string): SubjectViews {
  return Object.fromEntries(
    ids.map((id): [string, AuditSubjectView] => [id, { state: 'found', name: null, href }]),
  );
}

/** What one id turned out to be: named, gone (the list was read in full and lacks it), or found without a name. */
function viewOf(
  name: string | undefined,
  { isComplete, href }: { readonly isComplete: boolean; readonly href: string },
): AuditSubjectView {
  if (name !== undefined) {
    return { state: 'found', name, href };
  }
  // A cut-off list proves nothing, so an id it lacks is shown without a name, not as gone.
  return isComplete ? { state: 'gone' } : { state: 'found', name: null, href: null };
}

/** The ids of a kind named from what a lookup returned; nothing when the lookup was not made or failed. */
function named(
  ids: readonly string[],
  found: readonly NamedThing[] | null | undefined,
  options: { readonly isComplete: boolean; readonly hrefOf: (id: string) => string },
): SubjectViews {
  if (found === null || found === undefined) {
    return {};
  }
  const names = new Map(found.map(({ id, name }) => [id, name]));
  return Object.fromEntries(
    ids.map((id): [string, AuditSubjectView] => [
      id,
      viewOf(names.get(id), { isComplete: options.isComplete, href: options.hrefOf(id) }),
    ]),
  );
}

async function pagesAndMaps({ websiteId, ids }: Lookup): Promise<Found> {
  const pageIds = ids('page');
  const mapIds = ids('map');
  const [pages, maps] = await Promise.all([
    pageIds.length === 0
      ? null
      : orNull(getBuilderQueries().resolvePageTitles.execute(websiteId, pageIds)),
    mapIds.length === 0
      ? null
      : orNull(
          getMapQueries().listSavedMaps.execute(websiteId, {
            page: 1,
            pageSize: DEFAULT_PAGE_LIMITS.maxPageSize,
          }),
        ),
  ]);
  return {
    page: named(
      pageIds,
      pages?.map(({ id, title }) => ({ id, name: title })),
      { isComplete: true, hrefOf: (id) => builderRoutes.editor(websiteId, id) },
    ),
    map: named(mapIds, maps?.items, {
      isComplete: maps !== null && maps.total <= maps.items.length,
      hrefOf: (id) => mapRoutes.edit(websiteId, id),
    }),
  };
}

async function sourcesAndDatasets({ websiteId, ids }: Lookup): Promise<Found> {
  const dataSourceIds = ids('dataSource');
  const datasetIds = ids('dataset');
  const data =
    dataSourceIds.length + datasetIds.length === 0
      ? null
      : await orNull(
          getDataSourceQueries().resolveDataNames.execute(websiteId, { dataSourceIds, datasetIds }),
        );
  const isComplete = data !== null && !data.isTruncated;
  return {
    dataSource: named(dataSourceIds, data?.dataSources, {
      isComplete,
      hrefOf: (id) => dataSourceRoutes.source(websiteId, id),
    }),
    dataset: named(datasetIds, data?.datasets, {
      isComplete,
      hrefOf: () => dataSourceRoutes.sources(websiteId),
    }),
  };
}

async function bookingThings({ websiteId, ids }: Lookup): Promise<Found> {
  const [locationIds, serviceIds, resourceIds] = [ids('location'), ids('service'), ids('resource')];
  const names =
    locationIds.length + serviceIds.length + resourceIds.length === 0
      ? null
      : await orNull(getBookingQueries().getBookingNames.execute({ websiteId }));
  return {
    location: named(locationIds, names?.locations, {
      isComplete: true,
      hrefOf: (id) => bookingRoutes.location(websiteId, id),
    }),
    service: named(serviceIds, names?.services, {
      isComplete: names !== null && !names.isServicesTruncated,
      hrefOf: () => bookingRoutes.services(websiteId),
    }),
    resource: named(resourceIds, names?.resources, {
      isComplete: true,
      hrefOf: () => bookingRoutes.resources(websiteId),
    }),
    booking: unnamed(ids('booking'), bookingRoutes.bookingList(websiteId)),
  };
}

function releaseThings({ websiteId, ids }: Lookup): Found {
  return {
    release: unnamed(ids('release'), releaseRoutes.releases(websiteId)),
    migration: unnamed(ids('migration'), releaseRoutes.releases(websiteId)),
  };
}

/** A kind of subject is looked up only for a reader who may read its area. */
async function when(isAllowed: boolean, read: () => Promise<Found> | Found): Promise<Found> {
  return isAllowed ? read() : {};
}

/**
 * Names the things an audit entry refers to, for the reader of one website's trail: each kind only
 * when the reader may read that area, so what is absent here is exactly what is not theirs to see.
 * The audit module cannot reach the modules that own these things; the route does it for it.
 */
export function auditSubjectResolver(
  websiteId: string,
  access: WebsiteAccess,
): ResolveAuditSubjects {
  return async (subjectIds: AuditSubjectIds): Promise<AuditSubjects> => {
    const lookup: Lookup = { websiteId, ids: (kind) => subjectIds.get(kind) ?? [] };
    const found = await Promise.all([
      when(access.may('page.read'), () => pagesAndMaps(lookup)),
      when(access.may('datasource.read'), () => sourcesAndDatasets(lookup)),
      when(access.may('release.read'), () => releaseThings(lookup)),
      when(access.may('booking.read'), () => bookingThings(lookup)),
    ]);
    return Object.assign({}, ...found) as AuditSubjects;
  };
}
