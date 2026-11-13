import { clampToLastPage, offsetOf, resolvePageRequest, toPage } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import { buildQueryString, isBlank, unique } from '@lib/utils';

import { ANY_FILTER } from '../schemas/parse-service-list-input';

import type { TeamMemberSummaryDto } from '../dto/team-dto';

/** Fewer rows than the other lists by default: a person's row is tall. */
export const TEAM_PAGE_LIMITS = { defaultPageSize: 10, maxPageSize: 50 } as const;

/** What the address of the team list carries. */
export interface TeamListView {
  readonly search: string | undefined;
  readonly qualification: string | undefined;
  readonly pageSize: number;
}

type RawParams = Readonly<Record<string, string | string[] | undefined>>;

const firstOf = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const clean = (value: string | undefined) =>
  value === undefined || isBlank(value) || value === ANY_FILTER ? undefined : value.trim();
const SEARCH_MAX = 80;

/** What the address asks for, read without trusting it: anything that does not fit is the default. */
export function parseTeamListParams(raw: RawParams) {
  const slice = resolvePageRequest(
    { page: firstOf(raw['page']), pageSize: firstOf(raw['pageSize']) },
    TEAM_PAGE_LIMITS,
  );
  return {
    view: {
      search: clean(firstOf(raw['q']))?.slice(0, SEARCH_MAX),
      qualification: clean(firstOf(raw['qualification'])),
      pageSize: slice.pageSize,
    } satisfies TeamListView,
    page: slice.page,
  };
}

/** The address of the list with a different page and everything else kept. */
export function teamListHref(
  base: string,
  view: TeamListView,
  change: { readonly page?: number } = {},
): string {
  return `${base}${buildQueryString({
    q: view.search,
    qualification: view.qualification,
    page: change.page,
    pageSize: view.pageSize,
  })}`;
}

/** The members the filters let through, a page of them, and what the qualification filter can offer. */
export function teamSlice(
  members: readonly TeamMemberSummaryDto[],
  view: TeamListView,
  requestedPage: number,
): {
  readonly page: Page<TeamMemberSummaryDto>;
  readonly qualifications: readonly string[];
} {
  const needle = view.search?.toLowerCase();
  const matching = members.filter(
    (member) =>
      (needle === undefined || member.name.toLowerCase().includes(needle)) &&
      (view.qualification === undefined || member.qualifications.includes(view.qualification)),
  );
  const request = clampToLastPage(
    { page: requestedPage, pageSize: view.pageSize },
    matching.length,
  );
  const start = offsetOf(request);
  return {
    page: toPage(matching.slice(start, start + request.pageSize), matching.length, request),
    qualifications: unique(members.flatMap((member) => member.qualifications)).sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}
