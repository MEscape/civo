import { orNotFound } from '@lib/errors/or-not-found';
import type { Page } from '@lib/pagination';
import { unique } from '@lib/utils';

import type { MigrationSummaryView } from '../../application/contracts/migration-views';
import type { PublicationStatusView } from '../../application/contracts/publication-views';
import type { ReleaseHistoryView } from '../../application/contracts/release-views';
import type { ReleaseReaders } from '../../application/contracts/screen-views';
import type { ReleaseListParams } from '../schemas/release-list-params-schema';

export interface LoadReleaseAdministrationInput {
  readonly websiteId: string;
  /** The tab and the page of the history the address asks for, parsed by the screen. */
  readonly params: ReleaseListParams;
  readonly queries: ReleaseReaders;
}

/** The release screen in one of its two tabs: the history of releases, or the component updates. */
export type ReleaseAdministrationView =
  | {
      readonly kind: 'releases';
      readonly history: ReleaseHistoryView;
      /** The names of those who published, by actor id; `null` when they could not be named. */
      readonly authors: Readonly<Record<string, string>> | null;
    }
  | {
      readonly kind: 'updates';
      readonly history: Page<MigrationSummaryView>;
      readonly status: PublicationStatusView;
    };

async function readAuthors(
  queries: ReleaseReaders,
  history: ReleaseHistoryView,
): Promise<Readonly<Record<string, string>> | null> {
  const memberIds = unique(history.items.flatMap(({ publishedBy }) => publishedBy ?? []));
  if (memberIds.length === 0) {
    return null;
  }
  const resolved = await queries.resolveMemberNames(memberIds);
  return resolved.isOk()
    ? Object.fromEntries(resolved.value.names.map(({ id, name }) => [id, name]))
    : null;
}

/**
 * Reads what one tab of the release screen shows: the page of the history asked for by the
 * address and, beside it, the people or the update state it needs. A person who may not read
 * releases here gets "not found".
 */
export async function loadReleaseAdministration({
  websiteId,
  params,
  queries,
}: LoadReleaseAdministrationInput): Promise<ReleaseAdministrationView> {
  const { tab, ...page } = params;

  if (tab === 'updates') {
    const [history, status] = await Promise.all([
      orNotFound(queries.listMigrations.execute(websiteId, page)),
      orNotFound(queries.getPublicationStatus.execute(websiteId)),
    ]);
    return { kind: 'updates', history, status };
  }

  const history = await orNotFound(queries.listReleases.execute(websiteId, page));
  return { kind: 'releases', history, authors: await readAuthors(queries, history) };
}
