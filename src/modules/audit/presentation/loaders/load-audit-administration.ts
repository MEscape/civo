import type { Locale } from '@i18n';

import { orNotFound } from '@lib/errors/or-not-found';
import { unique } from '@lib/utils';

import { subjectIdsOf } from '../../application/contracts/audit-views';
import { parseAuditParams } from '../schemas/audit-filter-schema';

import { loadAuditEventLabels } from './load-audit-event-labels';

import type {
  AuditAcrossWebsitesView,
  AuditFilter,
  AuditReaders,
  AuditSubjectIds,
  AuditSubjects,
  AuditTrailView,
} from '../../application/contracts/audit-views';

export type AuditAdministrationScope =
  | { readonly kind: 'website'; readonly websiteId: string }
  | {
      readonly kind: 'global';
      readonly websiteAuditHref?: ((websiteId: string) => string) | undefined;
    };

export type AuditScope = AuditAdministrationScope;

/**
 * Names the things the shown entries refer to (pages, data, bookings), as far as the reader may
 * see them. Supplied by the route, which may reach the modules that own those things; audit may not.
 */
export type ResolveAuditSubjects = (ids: AuditSubjectIds) => Promise<AuditSubjects>;

export interface LoadAuditAdministrationInput {
  readonly locale: Locale;
  readonly pathname: string;
  readonly scope: AuditAdministrationScope;
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly queries: AuditReaders;
  /** Absent in the platform-wide trail, where what an entry names is shown by id. */
  readonly resolveSubjects?: ResolveAuditSubjects | undefined;
  readonly loadEventLabels?: (
    locale: Locale,
    entries: ReadonlyArray<{ readonly type: string }>,
  ) => Promise<Readonly<Record<string, string>>>;
}

export interface AuditAdministrationView {
  readonly filter: AuditFilter;
  readonly trail: AuditTrailView | AuditAcrossWebsitesView;
  readonly eventLabels: Readonly<Record<string, string>>;
  readonly names: Readonly<Record<string, string>> | null;
  readonly subjects: AuditSubjects;
  readonly websites?: ReadonlyArray<{ readonly id: string; readonly name: string }> | undefined;
  readonly websiteAuditHref?: ((websiteId: string) => string) | undefined;
}

/**
 * Loads everything the audit administration screen displays in either scope:
 * the filtered trail page, event facet counts, member names, and website options.
 * A user without read permission receives a 404.
 */
export async function loadAuditAdministration({
  locale,
  loadEventLabels = loadAuditEventLabels,
  scope,
  searchParams,
  queries,
  resolveSubjects,
}: LoadAuditAdministrationInput): Promise<AuditAdministrationView> {
  const { filter, page } = parseAuditParams(searchParams);

  const trail = await orNotFound<AuditTrailView | AuditAcrossWebsitesView>(
    scope.kind === 'website'
      ? queries.getAuditTrail.execute(scope.websiteId, filter, page)
      : queries.getAuditTrailAcrossWebsites.execute(filter, page),
  );

  const shown = trail.entries.items;
  const entryActors = shown
    .map((e) => e.actorId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const subjectIds = subjectIdsOf(shown);
  const allActorIds = unique([
    ...trail.memberIds,
    ...entryActors,
    ...(subjectIds.get('member') ?? []),
  ]);

  let names: Record<string, string> | null = null;
  if (allActorIds.length > 0 && queries.resolveMemberNames) {
    const namesResult = await queries.resolveMemberNames(allActorIds);
    if (namesResult.isOk()) {
      names = Object.fromEntries(namesResult.value.names.map((n) => [n.id, n.name]));
    }
  }

  return {
    filter,
    trail,
    eventLabels: await loadEventLabels(locale, [...shown, ...trail.types]),
    names,
    subjects: resolveSubjects === undefined ? {} : await resolveSubjects(subjectIds),
    websites: 'websites' in trail ? trail.websites : undefined,
    websiteAuditHref: scope.kind === 'global' ? scope.websiteAuditHref : undefined,
  };
}
