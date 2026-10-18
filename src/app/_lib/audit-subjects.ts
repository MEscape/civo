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

type Access = Awaited<ReturnType<typeof getWebsiteAccess>>;
type IdsOf = (kind: AuditSubjectKind) => readonly string[];

/** What every lookup below needs: the website, what the reader may see, and the ids on screen per kind. */
interface Scope {
  readonly websiteId: string;
  readonly access: Access;
  readonly idsOf: IdsOf;
}

/** The names of the pages, data and bookings asked for; a kind the reader may not read, or that does not appear, stays `null`. */
function lookUpNames({ websiteId, access, idsOf }: Scope) {
  const asks = (...kinds: AuditSubjectKind[]) => kinds.some((kind) => idsOf(kind).length > 0);
  return Promise.all([
    access.may('page.read') && asks('page')
      ? orNull(builderQueries.resolvePageTitles.execute(websiteId, [...idsOf('page')]))
      : null,
    access.may('datasource.read') && asks('dataSource', 'dataset')
      ? orNull(
          dataSourceQueries.resolveDataNames.execute(websiteId, {
            dataSourceIds: [...idsOf('dataSource')],
            datasetIds: [...idsOf('dataset')],
          }),
        )
      : null,
    access.may('booking.read') && asks('service', 'location', 'resource', 'booking')
      ? orNull(
          bookingQueries.resolveBookingNames.execute(websiteId, {
            serviceIds: [...idsOf('service')],
            locationIds: [...idsOf('location')],
            resourceIds: [...idsOf('resource')],
            bookingIds: [...idsOf('booking')],
          }),
        )
      : null,
  ]);
}

type Names = Awaited<ReturnType<typeof lookUpNames>>;

function pageSubjects({ websiteId, access, idsOf }: Scope, pages: Names[0]): AuditSubjects {
  if (pages === null) {
    return {};
  }
  const mayOpen = access.maySection('builder');
  return {
    page: subjectMap(
      idsOf('page'),
      pages.map(({ id, title }) => ({ id, name: title })),
      (id) => (mayOpen ? builderRoutes.editor(websiteId, id) : null),
    ),
  };
}

function dataSubjects({ websiteId, access, idsOf }: Scope, data: Names[1]): AuditSubjects {
  if (data === null) {
    return {};
  }
  const hrefOf = access.maySection('data') ? () => dataSourceRoutes.sources(websiteId) : () => null;
  return {
    dataSource: subjectMap(idsOf('dataSource'), data.dataSources, hrefOf),
    dataset: subjectMap(idsOf('dataset'), data.datasets, hrefOf),
  };
}

function bookingSubjects({ websiteId, access, idsOf }: Scope, booking: Names[2]): AuditSubjects {
  if (booking === null) {
    return {};
  }
  const mayOpen = access.maySection('bookings');
  const hrefOf = mayOpen ? () => bookingRoutes.admin(websiteId) : () => null;
  return {
    service: subjectMap(idsOf('service'), booking.services, hrefOf),
    location: subjectMap(idsOf('location'), booking.locations, (id) =>
      mayOpen ? bookingRoutes.location(websiteId, id) : null,
    ),
    resource: subjectMap(idsOf('resource'), booking.resources, hrefOf),
    booking: subjectMap(idsOf('booking'), booking.bookings, hrefOf),
  };
}

function releaseSubjects({ websiteId, access, idsOf }: Scope): AuditSubjects {
  if (!access.maySection('releases')) {
    return {};
  }
  return {
    release: linkedMap(idsOf('release'), (id) => releaseRoutes.preview(websiteId, id)),
    migration: linkedMap(idsOf('migration'), () => releaseRoutes.updates(websiteId)),
  };
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
  const idsOf: IdsOf = (kind) => ids.get(kind) ?? [];
  const access = await getWebsiteAccess();
  const scope: Scope = { websiteId, access, idsOf };
  const [pages, data, booking] = await lookUpNames(scope);

  return {
    ...pageSubjects(scope, pages),
    ...dataSubjects(scope, data),
    ...bookingSubjects(scope, booking),
    ...releaseSubjects(scope),
  };
}
